package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"vintrack-vinted/internal/proxy"
	"vintrack-vinted/internal/session"
	"vintrack-vinted/internal/vinted"
)

type Server struct {
	sessions   *session.Manager
	proxyMgr   *proxy.Manager
	listenAddr string
	apiKey     string
}

func NewServer(sessions *session.Manager, proxyMgr *proxy.Manager, addr string) *Server {
	return &Server{sessions: sessions, proxyMgr: proxyMgr, listenAddr: addr, apiKey: os.Getenv("API_KEY")}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/account/link", s.handleLink)
	mux.HandleFunc("DELETE /api/account/unlink", s.handleUnlink)
	mux.HandleFunc("GET /api/account/status", s.handleStatus)
	mux.HandleFunc("GET /api/account/info", s.handleInfo)

	mux.HandleFunc("POST /api/items/like", s.handleLike)
	mux.HandleFunc("POST /api/items/unlike", s.handleUnlike)
	mux.HandleFunc("GET /api/items/liked", s.handleLikedItems)
	mux.HandleFunc("GET /api/items/favorites", s.handleFavorites)
	mux.HandleFunc("GET /api/items/wardrobe", s.handleWardrobe)

	mux.HandleFunc("GET /api/messages/inbox", s.handleInbox)
	mux.HandleFunc("GET /api/notifications", s.handleNotifications)
	mux.HandleFunc("GET /api/messages/conversations/{id}", s.handleConversationReplies)
	mux.HandleFunc("POST /api/messages/send", s.handleSendMessage)
	mux.HandleFunc("POST /api/messages/reply", s.handleReplyToConversation)
	mux.HandleFunc("POST /api/offers/send", s.handleSendOffer)

	mux.HandleFunc("POST /api/account/refresh", s.handleRefreshToken)


	mux.HandleFunc("POST /api/photos/upload", s.handlePhotoUpload)
	mux.HandleFunc("POST /api/listings/create", s.handleCreateListing)
	mux.HandleFunc("PATCH /api/listings/{id}", s.handleUpdateListing)
	mux.HandleFunc("DELETE /api/listings/{id}", s.handleDeleteListing)
	mux.HandleFunc("POST /api/listings/{id}/relist", s.handleRelist)

	mux.HandleFunc("GET /api/catalog/search", s.handleCatalogSearch)

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok"})
	})

	log.Printf("API server listening on %s", s.listenAddr)
	return http.ListenAndServe(s.listenAddr, s.withMiddleware(mux))
}

func (s *Server) withMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-ID, X-API-Key")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		if s.apiKey != "" && r.URL.Path != "/health" {
			if r.Header.Get("X-API-Key") != s.apiKey {
				writeError(w, "invalid API key", 403)
				return
			}
		}
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}

func getUserID(r *http.Request) string {
	return r.Header.Get("X-User-ID")
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, msg string, status int) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (s *Server) getSessionAndClient(r *http.Request, w http.ResponseWriter) (*session.VintedSession, *vinted.Client, bool) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized: missing X-User-ID header", 401)
		return nil, nil, false
	}

	sess, err := s.sessions.Get(userID)
	if err != nil {
		writeError(w, "session fetch error", 500)
		return nil, nil, false
	}
	if sess == nil {
		writeError(w, "no linked Vinted account", 404)
		return nil, nil, false
	}

	proxyURL := ""
	if s.proxyMgr != nil {
		proxyURL = s.proxyMgr.Next()
	}
	client, err := vinted.NewClientWithProxy(sess, proxyURL)
	if err != nil {
		writeError(w, "failed to create Vinted client", 500)
		return nil, nil, false
	}

	if err := client.WarmUp(); err != nil {
		log.Printf("[session] warmup failed for user %s: %v", userID, err)
	}

	if sess.Status != "active" {
		log.Printf("[session] session for user %s is %s, attempting recovery...", userID, sess.Status)

		if sess.RefreshToken != "" {
			log.Printf("[session] attempting token refresh for user %s...", userID)
			if err := client.RefreshAccessToken(); err != nil {
				log.Printf("[session] token refresh failed for user %s: %v", userID, err)
			} else {
				log.Printf("[session] token refresh succeeded for user %s", userID)
				updated := client.GetSession()
				updated.Status = "active"
				updated.LastCheck = time.Now().UTC().Format(time.RFC3339)
				_ = s.sessions.Store(*updated)
				sess = updated
				return sess, client, true
			}
		}

		if client.ValidateSession() {
			log.Printf("[session] re-validation succeeded for user %s, reactivating session", userID)
			sess.Status = "active"
			sess.LastCheck = time.Now().UTC().Format(time.RFC3339)
			_ = s.sessions.Store(*sess)
		} else {
			writeError(w, "Vinted session is "+sess.Status+", please re-link", 403)
			return nil, nil, false
		}
	}

	return sess, client, true
}

type linkRequest struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	Domain       string `json:"domain"`
}

func (s *Server) handleLink(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized", 401)
		return
	}

	var req linkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", 400)
		return
	}

	if req.AccessToken == "" {
		writeError(w, "access_token is required", 400)
		return
	}
	if req.Domain == "" {
		writeError(w, "domain is required", 400)
		return
	}

	sess := session.VintedSession{
		UserID:       userID,
		AccessToken:  req.AccessToken,
		RefreshToken: req.RefreshToken,
		Domain:       req.Domain,
		Status:       "active",
		LinkedAt:     time.Now().UTC().Format(time.RFC3339),
		LastCheck:    time.Now().UTC().Format(time.RFC3339),
	}

	client, err := vinted.NewClient(&sess)
	if err != nil {
		writeError(w, "failed to create client: "+err.Error(), 500)
		return
	}

	if err := client.WarmUp(); err != nil {
		log.Printf("[link] warmup warning for user %s: %v", userID, err)
	}

	info, err := client.GetAccountInfo()
	if err != nil {
		writeError(w, "invalid token: "+err.Error(), 401)
		return
	}

	sess.VintedUserID = info.ID
	sess.VintedName = info.Login

	if err := s.sessions.Store(sess); err != nil {
		writeError(w, "failed to save session", 500)
		return
	}

	log.Printf("[account] linked user %s -> @%s (ID: %d) on %s", userID, info.Login, info.ID, req.Domain)

	writeJSON(w, 200, map[string]interface{}{
		"linked":      true,
		"vinted_name": info.Login,
		"vinted_id":   info.ID,
		"domain":      req.Domain,
	})
}

func (s *Server) handleUnlink(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized", 401)
		return
	}

	if err := s.sessions.Delete(userID); err != nil {
		writeError(w, "failed to unlink", 500)
		return
	}
	_ = s.sessions.DeleteLikes(userID)

	log.Printf("[account] unlinked user %s", userID)
	writeJSON(w, 200, map[string]string{"status": "unlinked"})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized", 401)
		return
	}

	sess, err := s.sessions.Get(userID)
	if err != nil {
		writeError(w, "error fetching session", 500)
		return
	}

	if sess == nil {
		writeJSON(w, 200, map[string]interface{}{"linked": false})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"linked":      true,
		"status":      sess.Status,
		"vinted_name": sess.VintedName,
		"vinted_id":   sess.VintedUserID,
		"domain":      sess.Domain,
		"linked_at":   sess.LinkedAt,
		"last_check":  sess.LastCheck,
	})
}

func (s *Server) handleInfo(w http.ResponseWriter, r *http.Request) {
	_, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	info, err := client.GetAccountInfo()
	if err != nil {
		writeError(w, "failed to fetch account: "+err.Error(), 502)
		return
	}

	writeJSON(w, 200, info)
}

type itemRequest struct {
	ItemID int64 `json:"item_id"`
}

func (s *Server) handleLike(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	var req itemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ItemID == 0 {
		writeError(w, "item_id is required", 400)
		return
	}

	if err := client.LikeItem(req.ItemID); err != nil {
		writeError(w, "like failed: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	userID := getUserID(r)
	_ = s.sessions.AddLike(userID, req.ItemID)

	writeJSON(w, 200, map[string]interface{}{"status": "liked", "item_id": req.ItemID})
}

func (s *Server) handleUnlike(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	var req itemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ItemID == 0 {
		writeError(w, "item_id is required", 400)
		return
	}

	if err := client.UnlikeItem(req.ItemID); err != nil {
		writeError(w, "unlike failed: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	userID := getUserID(r)
	_ = s.sessions.RemoveLike(userID, req.ItemID)

	writeJSON(w, 200, map[string]interface{}{"status": "unliked", "item_id": req.ItemID})
}

func (s *Server) handleLikedItems(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized", 401)
		return
	}

	ids, err := s.sessions.GetLikes(userID)
	if err != nil {
		writeError(w, "failed to fetch likes", 500)
		return
	}

	writeJSON(w, 200, map[string]interface{}{"item_ids": ids})
}

func (s *Server) handleFavorites(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	page := r.URL.Query().Get("page")
	favs, err := client.GetFavourites(sess.VintedUserID, page)
	if err != nil {
		writeError(w, "failed to fetch favorites: "+err.Error(), 502)
		return
	}

	client.EnrichFavorites(favs)

	s.persistIfRefreshed(sess, client)
	writeJSON(w, 200, favs)
}

func (s *Server) handleWardrobe(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	page := 1
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}

	perPage := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("per_page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			perPage = parsed
		}
	}

	order := strings.TrimSpace(r.URL.Query().Get("order"))
	if order == "" {
		order = "relevance"
	}

	wardrobe, err := client.GetWardrobe(sess.VintedUserID, page, perPage, order)
	if err != nil {
		writeError(w, "failed to fetch wardrobe: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)
	writeJSON(w, 200, wardrobe)
}

func (s *Server) handleInbox(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	page := 1
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}

	perPage := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("per_page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			perPage = parsed
		}
	}

	inbox, err := client.GetInbox(page, perPage)
	if err != nil {
		writeError(w, "failed to fetch inbox: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)
	writeJSON(w, 200, inbox)
}

func (s *Server) handleNotifications(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	page := 1
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}

	perPage := 5
	if raw := strings.TrimSpace(r.URL.Query().Get("per_page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 50 {
			perPage = parsed
		}
	}

	notifications, err := client.GetNotifications(page, perPage)
	if err != nil {
		writeError(w, "failed to fetch notifications: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)
	writeJSON(w, 200, notifications)
}

func (s *Server) handleConversationReplies(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	conversationID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || conversationID == 0 {
		writeError(w, "invalid conversation id", 400)
		return
	}

	page := 1
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}

	perPage := 100
	if raw := strings.TrimSpace(r.URL.Query().Get("per_page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 200 {
			perPage = parsed
		}
	}

	payload, err := client.GetConversationReplies(conversationID, page, perPage)
	if err != nil {
		writeError(w, "failed to fetch conversation replies: "+err.Error(), 502)
		return
	}

	payload["current_user_id"] = sess.VintedUserID

	s.persistIfRefreshed(sess, client)
	writeJSON(w, 200, payload)
}

func (s *Server) persistIfRefreshed(original *session.VintedSession, client *vinted.Client) {
	updated := client.GetSession()
	if updated.AccessToken != original.AccessToken {
		updated.Status = "active"
		updated.LastCheck = time.Now().UTC().Format(time.RFC3339)
		if err := s.sessions.Store(*updated); err != nil {
			log.Printf("[server] failed to persist refreshed session for user %s: %v", updated.UserID, err)
		} else {
			log.Printf("[server] persisted refreshed tokens for user %s", updated.UserID)
		}
	}
}

type sendMessageRequest struct {
	ItemID   int64  `json:"item_id"`
	SellerID int64  `json:"seller_id"`
	Message  string `json:"message"`
}

type replyToConversationRequest struct {
	ConversationID int64  `json:"conversation_id"`
	Message        string `json:"message"`
}

func (s *Server) handleSendMessage(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	var req sendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", 400)
		return
	}

	if req.ItemID == 0 {
		writeError(w, "item_id is required", 400)
		return
	}
	if req.SellerID == 0 {
		writeError(w, "seller_id is required", 400)
		return
	}
	msg := strings.TrimSpace(req.Message)
	if msg == "" {
		writeError(w, "message is required", 400)
		return
	}
	if len(msg) > 2000 {
		writeError(w, "message too long (max 2000 characters)", 400)
		return
	}

	if err := client.SendMessage(req.ItemID, req.SellerID, msg); err != nil {
		writeError(w, "send message failed: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	writeJSON(w, 200, map[string]interface{}{"status": "sent", "item_id": req.ItemID})
}

func (s *Server) handleReplyToConversation(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	var req replyToConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", 400)
		return
	}

	if req.ConversationID == 0 {
		writeError(w, "conversation_id is required", 400)
		return
	}

	msg := strings.TrimSpace(req.Message)
	if msg == "" {
		writeError(w, "message is required", 400)
		return
	}
	if len(msg) > 2000 {
		writeError(w, "message too long (max 2000 characters)", 400)
		return
	}

	if err := client.ReplyToConversation(req.ConversationID, msg); err != nil {
		writeError(w, "send reply failed: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	writeJSON(w, 200, map[string]interface{}{"status": "sent", "conversation_id": req.ConversationID})
}

type sendOfferRequest struct {
	ItemID   int64  `json:"item_id"`
	SellerID int64  `json:"seller_id"`
	Price    string `json:"price"`
	Currency string `json:"currency"`
}

func (s *Server) handleSendOffer(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	var req sendOfferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", 400)
		return
	}

	if req.ItemID == 0 {
		writeError(w, "item_id is required", 400)
		return
	}
	if req.SellerID == 0 {
		writeError(w, "seller_id is required", 400)
		return
	}
	if req.Price == "" {
		writeError(w, "price is required", 400)
		return
	}
	if req.Currency == "" {
		req.Currency = "EUR" // default
	}

	if err := client.SendOffer(req.ItemID, req.SellerID, req.Price, req.Currency); err != nil {
		writeError(w, err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	writeJSON(w, 200, map[string]interface{}{"status": "sent", "item_id": req.ItemID, "price": req.Price})
}

func (s *Server) handleRefreshToken(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized", 401)
		return
	}

	sess, err := s.sessions.Get(userID)
	if err != nil {
		writeError(w, "session fetch error", 500)
		return
	}
	if sess == nil {
		writeError(w, "no linked Vinted account", 404)
		return
	}
	if sess.RefreshToken == "" {
		writeError(w, "no refresh token available — please re-link with a refresh token", 400)
		return
	}

	proxyURL := ""
	if s.proxyMgr != nil {
		proxyURL = s.proxyMgr.Next()
	}
	client, err := vinted.NewClientWithProxy(sess, proxyURL)
	if err != nil {
		writeError(w, "failed to create client", 500)
		return
	}

	if err := client.WarmUp(); err != nil {
		log.Printf("[refresh] warmup warning for user %s: %v", userID, err)
	}

	if err := client.RefreshAccessToken(); err != nil {
		log.Printf("[refresh] token refresh failed for user %s: %v", userID, err)

		var body struct {
			RefreshToken string `json:"refresh_token"`
		}
		_ = json.NewDecoder(strings.NewReader("")).Decode(&body)

		writeError(w, "token refresh failed: "+err.Error(), 502)
		return
	}

	updated := client.GetSession()
	updated.Status = "active"
	updated.LastCheck = time.Now().UTC().Format(time.RFC3339)
	if err := s.sessions.Store(*updated); err != nil {
		writeError(w, "failed to save refreshed session", 500)
		return
	}

	log.Printf("[refresh] token refreshed for user %s (@%s)", userID, updated.VintedName)

	writeJSON(w, 200, map[string]interface{}{
		"status":      "refreshed",
		"vinted_name": updated.VintedName,
		"vinted_id":   updated.VintedUserID,
		"domain":      updated.Domain,
	})
}

// ── Listing Management Handlers ─────────────────────────────────────────

func (s *Server) handlePhotoUpload(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, "invalid multipart form: "+err.Error(), 400)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, "file field is required", 400)
		return
	}
	defer file.Close()

	fileData, err := io.ReadAll(file)
	if err != nil {
		writeError(w, "failed to read file", 500)
		return
	}

	if len(fileData) > 20<<20 {
		writeError(w, "file too large (max 20MB)", 400)
		return
	}

	photoID, err := client.UploadPhoto(fileData, header.Filename)
	if err != nil {
		writeError(w, "photo upload failed: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	writeJSON(w, 200, map[string]interface{}{"id": photoID})
}

type createListingRequest struct {
	Title         string                   `json:"title"`
	Description   string                   `json:"description"`
	Price         string                   `json:"price"`
	Currency      string                   `json:"currency"`
	Brand         string                   `json:"brand,omitempty"`
	BrandID       *int64                   `json:"brand_id,omitempty"`
	CatalogID     int64                    `json:"catalog_id"`
	StatusID      *int64                   `json:"status_id,omitempty"`
	PackageSizeID *int64                   `json:"package_size_id,omitempty"`
	ColorIDs      []int64                  `json:"color_ids,omitempty"`
	PhotoIDs      []map[string]interface{} `json:"photo_ids"`
}

func (s *Server) handleCreateListing(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	var req createListingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", 400)
		return
	}

	if req.Title == "" {
		writeError(w, "title is required", 400)
		return
	}
	if req.Price == "" {
		writeError(w, "price is required", 400)
		return
	}
	if len(req.PhotoIDs) == 0 {
		writeError(w, "at least one photo is required", 400)
		return
	}

	payload := map[string]interface{}{
		"title":       req.Title,
		"description": req.Description,
		"price":       req.Price,
		"currency":    req.Currency,
		"photo_ids":   req.PhotoIDs,
	}

	if req.Brand != "" {
		payload["brand"] = req.Brand
	}
	if req.BrandID != nil {
		payload["brand_id"] = *req.BrandID
	}
	if req.CatalogID != 0 {
		payload["catalog_id"] = req.CatalogID
	}
	if req.StatusID != nil {
		payload["status_id"] = *req.StatusID
	}
	if req.PackageSizeID != nil {
		payload["package_size_id"] = *req.PackageSizeID
	}
	if len(req.ColorIDs) > 0 {
		payload["color_ids"] = req.ColorIDs
	}

	itemID, itemURL, err := client.CreateItem(payload)
	if err != nil {
		writeError(w, "create listing failed: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	writeJSON(w, 200, map[string]interface{}{
		"item_id": itemID,
		"url":     itemURL,
	})
}

func (s *Server) handleUpdateListing(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	itemID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || itemID == 0 {
		writeError(w, "invalid listing id", 400)
		return
	}

	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, "invalid request body", 400)
		return
	}

	if len(payload) == 0 {
		writeError(w, "at least one field to update is required", 400)
		return
	}

	if err := client.UpdateItem(itemID, payload); err != nil {
		writeError(w, "update listing failed: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	writeJSON(w, 200, map[string]interface{}{
		"status":  "updated",
		"item_id": itemID,
	})
}

func (s *Server) handleDeleteListing(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	itemID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || itemID == 0 {
		writeError(w, "invalid listing id", 400)
		return
	}

	if err := client.DeleteItem(itemID); err != nil {
		writeError(w, "delete listing failed: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	writeJSON(w, 200, map[string]interface{}{
		"status":  "deleted",
		"item_id": itemID,
	})
}

func (s *Server) handleRelist(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	itemID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || itemID == 0 {
		writeError(w, "invalid listing id", 400)
		return
	}

	// 1. Hide the item
	if err := client.HideItem(itemID); err != nil {
		writeError(w, "relist: failed to hide item: "+err.Error(), 502)
		return
	}

	log.Printf("[relist] hidden item %d, waiting before unhide...", itemID)

	// 2. Wait 2 seconds for Vinted to register the change
	time.Sleep(2 * time.Second)

	// 3. Unhide the item (makes it appear as freshly listed)
	if err := client.UnhideItem(itemID); err != nil {
		writeError(w, "relist: hid item but failed to unhide: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	log.Printf("[relist] item %d relisted via hide/unhide", itemID)

	writeJSON(w, 200, map[string]interface{}{
		"item_id": itemID,
		"status":  "relisted",
	})
}

func (s *Server) handleCatalogSearch(w http.ResponseWriter, r *http.Request) {
	// Catalog search is public (no user token needed) — create anonymous client
	apiKey := s.apiKey
	if apiKey != "" && r.Header.Get("X-API-Key") != apiKey {
		writeError(w, "invalid API key", 403)
		return
	}

	anonSession := &session.VintedSession{
		Domain:      "vinted.de",
		Status:      "active",
	}
	region := strings.TrimSpace(r.URL.Query().Get("region"))
	if region != "" {
		domainMap := map[string]string{
			"de": "vinted.de", "fr": "vinted.fr", "it": "vinted.it", "es": "vinted.es",
			"nl": "vinted.nl", "pl": "vinted.pl", "be": "vinted.be", "at": "vinted.at",
			"uk": "vinted.co.uk", "cz": "vinted.cz", "lt": "vinted.lt", "se": "vinted.se",
			"hu": "vinted.hu", "ro": "vinted.ro", "dk": "vinted.dk", "fi": "vinted.fi",
			"hr": "vinted.hr", "pt": "vinted.pt",
		}
		if d, ok := domainMap[region]; ok {
			anonSession.Domain = d
		}
	}

	proxyURL := ""
	if s.proxyMgr != nil {
		proxyURL = s.proxyMgr.Next()
	}
	client, err := vinted.NewClientWithProxy(anonSession, proxyURL)
	if err != nil {
		writeError(w, "failed to create client", 500)
		return
	}
	if err := client.WarmUp(); err != nil {
		log.Printf("[catalog] warmup warning: %v", err)
	}

	catalogIDStr := strings.TrimSpace(r.URL.Query().Get("catalog_id"))
	if catalogIDStr == "" {
		writeError(w, "catalog_id is required", 400)
		return
	}
	catalogID, err := strconv.Atoi(catalogIDStr)
	if err != nil || catalogID <= 0 {
		writeError(w, "invalid catalog_id", 400)
		return
	}

	page := 1
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}

	perPage := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("per_page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			perPage = parsed
		}
	}

	order := strings.TrimSpace(r.URL.Query().Get("order"))
	if order == "" {
		order = "newest_first"
	}

	result, searchErr := client.SearchCatalog(catalogID, region, page, perPage, order)
	if searchErr != nil {
		writeError(w, "catalog search failed: "+searchErr.Error(), 502)
		return
	}

	writeJSON(w, 200, result)
}
