package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/microsoft"
)

type Config struct {
	Enabled      bool
	Provider     string // "github" or "entra"
	ClientID     string
	ClientSecret string
	RedirectURL  string
	Scopes       []string
	AllowedUsers []string // Optional: restrict to specific users/emails
}

type OAuthProvider struct {
	config       *oauth2.Config
	providerType string
	allowedUsers map[string]bool
}

type UserInfo struct {
	ID       string
	Email    string
	Name     string
	Username string
	Provider string
}

func NewOAuthProvider(cfg Config) (*OAuthProvider, error) {
	if !cfg.Enabled {
		return nil, nil
	}

	var oauthConfig *oauth2.Config

	switch cfg.Provider {
	case "github":
		oauthConfig = &oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			RedirectURL:  cfg.RedirectURL,
			Scopes:       cfg.Scopes,
			Endpoint:     github.Endpoint,
		}
		if len(cfg.Scopes) == 0 {
			oauthConfig.Scopes = []string{"user:email", "read:user"}
		}

	case "entra", "azure":
		oauthConfig = &oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			RedirectURL:  cfg.RedirectURL,
			Scopes:       cfg.Scopes,
			Endpoint:     microsoft.AzureADEndpoint("common"),
		}
		if len(cfg.Scopes) == 0 {
			oauthConfig.Scopes = []string{"openid", "profile", "email"}
		}

	default:
		return nil, fmt.Errorf("unsupported OAuth provider: %s", cfg.Provider)
	}

	allowedUsersMap := make(map[string]bool)
	for _, user := range cfg.AllowedUsers {
		allowedUsersMap[user] = true
	}

	return &OAuthProvider{
		config:       oauthConfig,
		providerType: cfg.Provider,
		allowedUsers: allowedUsersMap,
	}, nil
}

func (p *OAuthProvider) GetAuthURL(state string) string {
	return p.config.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

func (p *OAuthProvider) Exchange(ctx context.Context, code string) (*oauth2.Token, error) {
	return p.config.Exchange(ctx, code)
}

func (p *OAuthProvider) GetUserInfo(ctx context.Context, token *oauth2.Token) (*UserInfo, error) {
	switch p.providerType {
	case "github":
		return p.getGitHubUserInfo(ctx, token)
	case "entra", "azure":
		return p.getEntraUserInfo(ctx, token)
	default:
		return nil, fmt.Errorf("unsupported provider: %s", p.providerType)
	}
}

func (p *OAuthProvider) getGitHubUserInfo(ctx context.Context, token *oauth2.Token) (*UserInfo, error) {
	client := p.config.Client(ctx, token)

	resp, err := client.Get("https://api.github.com/user")
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var githubUser struct {
		ID       int64  `json:"id"`
		Login    string `json:"login"`
		Email    string `json:"email"`
		Name     string `json:"name"`
		AvatarURL string `json:"avatar_url"`
	}

	if err := json.Unmarshal(body, &githubUser); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	// If email is not public, fetch it from emails endpoint
	if githubUser.Email == "" {
		emailResp, err := client.Get("https://api.github.com/user/emails")
		if err == nil {
			defer emailResp.Body.Close()
			emailBody, _ := io.ReadAll(emailResp.Body)
			var emails []struct {
				Email   string `json:"email"`
				Primary bool   `json:"primary"`
			}
			if json.Unmarshal(emailBody, &emails) == nil {
				for _, e := range emails {
					if e.Primary {
						githubUser.Email = e.Email
						break
					}
				}
			}
		}
	}

	return &UserInfo{
		ID:       fmt.Sprintf("%d", githubUser.ID),
		Email:    githubUser.Email,
		Name:     githubUser.Name,
		Username: githubUser.Login,
		Provider: "github",
	}, nil
}

func (p *OAuthProvider) getEntraUserInfo(ctx context.Context, token *oauth2.Token) (*UserInfo, error) {
	client := p.config.Client(ctx, token)

	resp, err := client.Get("https://graph.microsoft.com/v1.0/me")
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var msUser struct {
		ID                string `json:"id"`
		UserPrincipalName string `json:"userPrincipalName"`
		Mail              string `json:"mail"`
		DisplayName       string `json:"displayName"`
		GivenName         string `json:"givenName"`
		Surname           string `json:"surname"`
	}

	if err := json.Unmarshal(body, &msUser); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	email := msUser.Mail
	if email == "" {
		email = msUser.UserPrincipalName
	}

	return &UserInfo{
		ID:       msUser.ID,
		Email:    email,
		Name:     msUser.DisplayName,
		Username: msUser.UserPrincipalName,
		Provider: "entra",
	}, nil
}

func (p *OAuthProvider) IsUserAllowed(userInfo *UserInfo) bool {
	if len(p.allowedUsers) == 0 {
		return true // No restrictions
	}

	return p.allowedUsers[userInfo.Email] || p.allowedUsers[userInfo.Username]
}

func GenerateState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// Session management
type Session struct {
	Token     string
	UserInfo  *UserInfo
	ExpiresAt time.Time
}

type SessionStore struct {
	sessions map[string]*Session
}

func NewSessionStore() *SessionStore {
	return &SessionStore{
		sessions: make(map[string]*Session),
	}
}

func (s *SessionStore) Create(userInfo *UserInfo) (string, error) {
	token, err := GenerateState()
	if err != nil {
		return "", err
	}

	s.sessions[token] = &Session{
		Token:     token,
		UserInfo:  userInfo,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}

	return token, nil
}

func (s *SessionStore) Get(token string) (*Session, bool) {
	session, exists := s.sessions[token]
	if !exists {
		return nil, false
	}

	if time.Now().After(session.ExpiresAt) {
		delete(s.sessions, token)
		return nil, false
	}

	return session, true
}

func (s *SessionStore) Delete(token string) {
	delete(s.sessions, token)
}

func (s *SessionStore) CleanExpired() {
	for token, session := range s.sessions {
		if time.Now().After(session.ExpiresAt) {
			delete(s.sessions, token)
		}
	}
}
