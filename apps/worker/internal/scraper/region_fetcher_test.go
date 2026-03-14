package scraper

import (
	"testing"
)

func TestParseSellerInfoFromHTML_JSONCountryTitle(t *testing.T) {
	html := `{"user":{"id":123,"country_title":"Deutschland","feedback_reputation":0.95,"feedback_count":42}}`
	info := parseSellerInfoFromHTML([]byte(html))

	if info.Region != "🇩🇪 DE" {
		t.Errorf("Region = %q, want '🇩🇪 DE'", info.Region)
	}
	if info.Rating == "" {
		t.Error("Rating should not be empty")
	}
}

func TestParseSellerInfoFromHTML_ISOCountryCode(t *testing.T) {
	html := `{"addressCountry": "FR"}`
	info := parseSellerInfoFromHTML([]byte(html))

	if info.Region != "🇫🇷 FR" {
		t.Errorf("Region = %q, want '🇫🇷 FR'", info.Region)
	}
}

func TestParseSellerInfoFromHTML_FrenchCountryTitle(t *testing.T) {
	html := `{"country_title": "France"}`
	info := parseSellerInfoFromHTML([]byte(html))

	if info.Region != "🇫🇷 FR" {
		t.Errorf("Region = %q, want '🇫🇷 FR'", info.Region)
	}
}

func TestParseSellerInfoFromHTML_Rating(t *testing.T) {
	html := `{"feedback_reputation": 0.9, "feedback_count": 15}`
	info := parseSellerInfoFromHTML([]byte(html))

	if info.Rating == "" {
		t.Error("Rating should be extracted from feedback_reputation")
	}
	if info.Rating != "⭐ 0.9 (15)" {
		t.Errorf("Rating = %q, want '⭐ 0.9 (15)'", info.Rating)
	}
}

func TestParseSellerInfoFromHTML_AriaLabelRating(t *testing.T) {
	html := `<div aria-label="4,5 von 5 Sternen"></div>`
	info := parseSellerInfoFromHTML([]byte(html))

	if info.Rating == "" {
		t.Error("Rating should be extracted from aria-label")
	}
}

func TestParseSellerInfoFromHTML_NoData(t *testing.T) {
	html := `<html><body>nothing useful</body></html>`
	info := parseSellerInfoFromHTML([]byte(html))

	if info.Region != "" {
		t.Errorf("Region should be empty for no-data HTML, got %q", info.Region)
	}
	if info.Rating != "" {
		t.Errorf("Rating should be empty for no-data HTML, got %q", info.Rating)
	}
}

func TestParseSellerInfoFromHTML_HTMLCountryName(t *testing.T) {
	html := `<span>München, DEUTSCHLAND</span>`
	info := parseSellerInfoFromHTML([]byte(html))

	if info.Region != "🇩🇪 DE" {
		t.Errorf("Region = %q, want '🇩🇪 DE'", info.Region)
	}
}

func TestParseSellerInfoFromHTML_UKCountry(t *testing.T) {
	html := `{"country_title": "United Kingdom"}`
	info := parseSellerInfoFromHTML([]byte(html))

	if info.Region != "🇬🇧 UK" {
		t.Errorf("Region = %q, want '🇬🇧 UK'", info.Region)
	}
}

func TestParseSellerInfoFromHTML_PolishCountry(t *testing.T) {
	html := `{"country_title": "Polska"}`
	info := parseSellerInfoFromHTML([]byte(html))

	if info.Region != "🇵🇱 PL" {
		t.Errorf("Region = %q, want '🇵🇱 PL'", info.Region)
	}
}

func TestSellerInfoCache_SetAndGet(t *testing.T) {
	cache := &sellerInfoCache{
		cache: make(map[int64]sellerCacheEntry, 16),
	}

	info := SellerInfo{Region: "🇩🇪 DE", Rating: "⭐ 4.5 (10)"}
	cache.Set(123, info)

	got, ok := cache.Get(123)
	if !ok {
		t.Fatal("Expected cache hit for user 123")
	}
	if got.Region != info.Region {
		t.Errorf("Region = %q, want %q", got.Region, info.Region)
	}
	if got.Rating != info.Rating {
		t.Errorf("Rating = %q, want %q", got.Rating, info.Rating)
	}
}

func TestSellerInfoCache_Miss(t *testing.T) {
	cache := &sellerInfoCache{
		cache: make(map[int64]sellerCacheEntry, 16),
	}

	_, ok := cache.Get(999)
	if ok {
		t.Error("Expected cache miss for non-existent user")
	}
}

func TestSellerInfoCache_Overwrite(t *testing.T) {
	cache := &sellerInfoCache{
		cache: make(map[int64]sellerCacheEntry, 16),
	}

	cache.Set(1, SellerInfo{Region: "🇩🇪 DE"})
	cache.Set(1, SellerInfo{Region: "🇫🇷 FR"})

	got, _ := cache.Get(1)
	if got.Region != "🇫🇷 FR" {
		t.Errorf("Overwritten region = %q, want '🇫🇷 FR'", got.Region)
	}
}

func TestISOCountryMap_Coverage(t *testing.T) {
	expectedCodes := []string{"DE", "FR", "IT", "ES", "NL", "PL", "AT", "BE", "GB", "UK", "LU", "PT"}
	for _, code := range expectedCodes {
		if _, ok := isoCountryMap[code]; !ok {
			t.Errorf("isoCountryMap missing code %q", code)
		}
	}
}
