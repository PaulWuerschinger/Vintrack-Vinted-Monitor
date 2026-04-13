package proxy

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
)

type Manager struct {
	proxies []string
	index   int
	mu      sync.Mutex
}

func Load(filepath string) *Manager {
	m := &Manager{}
	file, err := os.Open(filepath)
	if err != nil {
		log.Printf("No proxy file at %s, running without proxies", filepath)
		return m
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		p := parseLine(line)
		if p != "" {
			m.proxies = append(m.proxies, p)
		}
	}
	log.Printf("Loaded %d proxies for vinted-service", len(m.proxies))
	return m
}

func parseLine(line string) string {
	if strings.HasPrefix(line, "http") || strings.HasPrefix(line, "socks") {
		return line
	}
	parts := strings.Split(line, ":")
	if len(parts) == 4 {
		return fmt.Sprintf("http://%s:%s@%s:%s", parts[2], parts[3], parts[0], parts[1])
	}
	if len(parts) == 2 {
		return "http://" + line
	}
	return ""
}

func (m *Manager) Next() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.proxies) == 0 {
		return ""
	}
	proxy := m.proxies[m.index]
	m.index = (m.index + 1) % len(m.proxies)
	return proxy
}

func (m *Manager) Count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.proxies)
}
