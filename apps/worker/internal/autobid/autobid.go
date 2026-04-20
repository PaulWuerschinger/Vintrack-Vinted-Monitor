// Package autobid triggers an offer (bid) on the Vinted marketplace when a
// monitor finds a qualifying item. It enforces a hard daily cap per user and
// idempotency per (monitor, item) combination.
package autobid

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"vintrack-worker/internal/database"
	"vintrack-worker/internal/model"
)

const MaxBidsPerUserPerDay = 20

type Service struct {
	db         *database.Store
	serviceURL string
	httpClient *http.Client
}

func NewService(db *database.Store, serviceURL string) *Service {
	return &Service{
		db:         db,
		serviceURL: strings.TrimRight(serviceURL, "/"),
		httpClient: &http.Client{Timeout: 20 * time.Second},
	}
}

// HandleNewItems fires bids for every item that passes monitor auto-bid rules.
// It runs best-effort — errors are logged and written to auto_bid_logs but never
// interrupt the scanner.
func (s *Service) HandleNewItems(ctx context.Context, m model.Monitor, items []model.Item, vItems []model.VintedItem) {
	if !m.AutoBidEnabled || s == nil || s.serviceURL == "" {
		return
	}
	if len(items) != len(vItems) {
		log.Printf("[%d][autobid] length mismatch items=%d vItems=%d, skipping", m.ID, len(items), len(vItems))
		return
	}

	for i := range items {
		select {
		case <-ctx.Done():
			return
		default:
		}
		s.tryBid(ctx, m, items[i], vItems[i])
	}
}

func (s *Service) tryBid(ctx context.Context, m model.Monitor, it model.Item, vIt model.VintedItem) {
	count, err := s.db.CountBidsToday(m.UserID)
	if err != nil {
		log.Printf("[%d][autobid] daily count error: %v", m.ID, err)
		return
	}
	if count >= MaxBidsPerUserPerDay {
		log.Printf("[%d][autobid] daily limit reached (%d) for user %s", m.ID, count, m.UserID)
		return
	}

	inserted, err := s.db.InsertBidLog(m.ID, m.UserID, it.ID, "pending")
	if err != nil {
		log.Printf("[%d][autobid] insert log error for item %d: %v", m.ID, it.ID, err)
		return
	}
	if !inserted {
		return
	}

	price, ok := parsePriceEUR(it.Price)
	if !ok {
		s.db.UpdateBidLog(m.ID, it.ID, "failed", nil, fmt.Sprintf("price parse: %q", it.Price))
		return
	}

	discount := 0.0
	if m.AutoBidDiscountPct.Valid {
		discount = float64(m.AutoBidDiscountPct.Int32) / 100.0
		if discount < 0 {
			discount = 0
		}
		if discount > 0.99 {
			discount = 0.99
		}
	}
	offerPrice := price * (1 - discount)
	if m.AutoBidMaxPrice.Valid {
		maxPrice, err := strconv.ParseFloat(m.AutoBidMaxPrice.String, 64)
		if err == nil && offerPrice > maxPrice {
			offerPrice = maxPrice
		}
	}
	if offerPrice <= 0 {
		s.db.UpdateBidLog(m.ID, it.ID, "failed", nil, "offer price <= 0")
		return
	}

	sellerID := vIt.User.ID
	if sellerID == 0 {
		sellerID = it.SellerID
	}
	if sellerID == 0 {
		s.db.UpdateBidLog(m.ID, it.ID, "failed", nil, "missing seller id")
		return
	}

	body, _ := json.Marshal(map[string]interface{}{
		"item_id":   it.ID,
		"seller_id": sellerID,
		"price":     fmt.Sprintf("%.2f", offerPrice),
		"currency":  "EUR",
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.serviceURL+"/api/offers/send", bytes.NewReader(body))
	if err != nil {
		s.db.UpdateBidLog(m.ID, it.ID, "failed", nil, err.Error())
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-Id", m.UserID)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.db.UpdateBidLog(m.ID, it.ID, "failed", nil, err.Error())
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		errSnippet := string(respBody)
		if len(errSnippet) > 300 {
			errSnippet = errSnippet[:300]
		}
		s.db.UpdateBidLog(m.ID, it.ID, "failed", nil, fmt.Sprintf("HTTP %d: %s", resp.StatusCode, errSnippet))
		return
	}

	s.db.UpdateBidLog(m.ID, it.ID, "success", &offerPrice, "")
	log.Printf("[%d][autobid] bid %.2f EUR on item %d (seller %d)", m.ID, offerPrice, it.ID, sellerID)
}

// parsePriceEUR extracts a EUR number from strings like "4.90 EUR" or "4,90 EUR".
func parsePriceEUR(raw string) (float64, bool) {
	s := strings.TrimSpace(raw)
	s = strings.TrimSuffix(s, "EUR")
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ",", ".")
	if s == "" {
		return 0, false
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, false
	}
	return f, true
}
