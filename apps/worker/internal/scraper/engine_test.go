package scraper

import (
	"testing"
	"time"
	"vintrack-worker/internal/model"
)

func TestBuildItems_BasicConstruction(t *testing.T) {
	e := &Engine{}
	m := model.Monitor{
		ID:     1,
		Query:  "test",
		Region: "de",
	}
	vItems := []model.VintedItem{
		{
			ID:         12345,
			Title:      "Nike Air Max 90",
			Price:      model.VintedPrice{Amount: "49.00", Currency: "EUR"},
			Url:        "/items/12345-nike-air-max-90",
			Photo:      model.VintedPhoto{Url: "https://img.vinted.de/photo1.jpg"},
			SizeTitle:  "42",
			BrandTitle: "Nike",
			Condition:  "Gut",
			User:       model.VintedUser{ID: 99, Login: "seller1"},
		},
	}

	items := e.buildItems(m, vItems)

	if len(items) != 1 {
		t.Fatalf("Expected 1 item, got %d", len(items))
	}

	item := items[0]

	if item.ID != 12345 {
		t.Errorf("ID = %d, want 12345", item.ID)
	}
	if item.MonitorID != 1 {
		t.Errorf("MonitorID = %d, want 1", item.MonitorID)
	}
	if item.Title != "Nike Air Max 90" {
		t.Errorf("Title = %q, want %q", item.Title, "Nike Air Max 90")
	}
	if item.Brand != "Nike" {
		t.Errorf("Brand = %q, want %q", item.Brand, "Nike")
	}
	if item.Price != "49.00 EUR" {
		t.Errorf("Price = %q, want %q", item.Price, "49.00 EUR")
	}
	if item.Size != "42" {
		t.Errorf("Size = %q, want %q", item.Size, "42")
	}
	if item.Condition != "Gut" {
		t.Errorf("Condition = %q, want %q", item.Condition, "Gut")
	}
	if item.SellerID != 99 {
		t.Errorf("SellerID = %d, want 99", item.SellerID)
	}
}

func TestBuildItems_URLPrefixing(t *testing.T) {
	e := &Engine{}
	m := model.Monitor{ID: 1, Region: "fr"}

	tests := []struct {
		name        string
		inputURL    string
		expectedURL string
	}{
		{"relative URL", "/items/123-test", "https://www.vinted.fr/items/123-test"},
		{"absolute URL", "https://www.vinted.fr/items/123-test", "https://www.vinted.fr/items/123-test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			vItems := []model.VintedItem{
				{ID: 1, Url: tt.inputURL, Price: model.VintedPrice{Amount: "10", Currency: "EUR"}, User: model.VintedUser{ID: 1}},
			}
			items := e.buildItems(m, vItems)
			if items[0].URL != tt.expectedURL {
				t.Errorf("URL = %q, want %q", items[0].URL, tt.expectedURL)
			}
		})
	}
}

func TestBuildItems_SizeFallback(t *testing.T) {
	e := &Engine{}
	m := model.Monitor{ID: 1, Region: "de"}

	// When SizeTitle is empty, should fall back to Size
	vItems := []model.VintedItem{
		{ID: 1, SizeTitle: "", Size: "M", Price: model.VintedPrice{Amount: "10", Currency: "EUR"}, User: model.VintedUser{ID: 1}},
	}
	items := e.buildItems(m, vItems)
	if items[0].Size != "M" {
		t.Errorf("Size fallback: got %q, want %q", items[0].Size, "M")
	}

	// When SizeTitle is set, should use SizeTitle
	vItems[0].SizeTitle = "L / 42"
	items = e.buildItems(m, vItems)
	if items[0].Size != "L / 42" {
		t.Errorf("Size from SizeTitle: got %q, want %q", items[0].Size, "L / 42")
	}
}

func TestBuildItems_TotalPrice(t *testing.T) {
	e := &Engine{}
	m := model.Monitor{ID: 1, Region: "de"}

	// With total price
	vItems := []model.VintedItem{
		{
			ID:             1,
			Price:          model.VintedPrice{Amount: "10", Currency: "EUR"},
			TotalItemPrice: &model.VintedPrice{Amount: "12.50", Currency: "EUR"},
			User:           model.VintedUser{ID: 1},
		},
	}
	items := e.buildItems(m, vItems)
	if items[0].TotalPrice != "12.50 EUR" {
		t.Errorf("TotalPrice = %q, want %q", items[0].TotalPrice, "12.50 EUR")
	}

	// Without total price
	vItems[0].TotalItemPrice = nil
	items = e.buildItems(m, vItems)
	if items[0].TotalPrice != "" {
		t.Errorf("TotalPrice should be empty when nil, got %q", items[0].TotalPrice)
	}
}

func TestBuildItems_ExtraImages(t *testing.T) {
	e := &Engine{}
	m := model.Monitor{ID: 1, Region: "de"}

	vItems := []model.VintedItem{
		{
			ID:    1,
			Photo: model.VintedPhoto{Url: "https://img1.jpg"},
			Photos: []model.VintedPhoto{
				{Url: "https://img1.jpg"}, // First photo (skipped, it's the main photo)
				{Url: "https://img2.jpg"},
				{Url: "https://img3.jpg"},
			},
			Price: model.VintedPrice{Amount: "10", Currency: "EUR"},
			User:  model.VintedUser{ID: 1},
		},
	}
	items := e.buildItems(m, vItems)

	if len(items[0].ExtraImages) != 2 {
		t.Errorf("ExtraImages count = %d, want 2", len(items[0].ExtraImages))
	}
	if items[0].ExtraImages[0] != "https://img2.jpg" {
		t.Errorf("ExtraImages[0] = %q, want %q", items[0].ExtraImages[0], "https://img2.jpg")
	}
}

func TestBuildItems_FoundAtIsRecent(t *testing.T) {
	e := &Engine{}
	m := model.Monitor{ID: 1, Region: "de"}

	before := time.Now().Add(-time.Second)
	vItems := []model.VintedItem{
		{ID: 1, Price: model.VintedPrice{Amount: "10", Currency: "EUR"}, User: model.VintedUser{ID: 1}},
	}
	items := e.buildItems(m, vItems)
	after := time.Now().Add(time.Second)

	if items[0].FoundAt.Before(before) || items[0].FoundAt.After(after) {
		t.Errorf("FoundAt = %v, should be close to now", items[0].FoundAt)
	}
}

func TestBuildItems_MultipleItems(t *testing.T) {
	e := &Engine{}
	m := model.Monitor{ID: 5, Region: "nl"}

	vItems := make([]model.VintedItem, 20)
	for i := range vItems {
		vItems[i] = model.VintedItem{
			ID:    int64(i + 1),
			Title: "Item",
			Price: model.VintedPrice{Amount: "10", Currency: "EUR"},
			User:  model.VintedUser{ID: int64(i)},
		}
	}

	items := e.buildItems(m, vItems)
	if len(items) != 20 {
		t.Errorf("Expected 20 items, got %d", len(items))
	}
	for i, item := range items {
		if item.MonitorID != 5 {
			t.Errorf("Item %d: MonitorID = %d, want 5", i, item.MonitorID)
		}
	}
}
