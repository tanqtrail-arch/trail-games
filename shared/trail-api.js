/**
 * TRAIL API Client - GAS Backend Communication
 *
 * Usage:
 *   TrailAPI.configure('https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec');
 *   TrailAPI.login('たろう', '探究ベーシック').then(user => ...);
 */
(function(global) {
  'use strict';

  // GAS Web App URL — set this after deploying
  var _gasUrl = '';
  var _user = null;

  // Session storage key
  var SESSION_KEY = 'trail:session';

  var TrailAPI = {
    /** Set the GAS deployment URL */
    configure: function(url) {
      _gasUrl = url;
    },

    /** Check if GAS is configured */
    isConfigured: function() {
      return !!_gasUrl;
    },

    // === Auth ===

    /** Login or register */
    login: function(name, className) {
      return _post({ action: 'login', name: name, className: className })
        .then(function(res) {
          if (res.error) throw new Error(res.error);
          _user = res;
          _saveSession(res);
          return res;
        });
    },

    /** Get current user (from memory or session) */
    currentUser: function() {
      if (_user) return _user;
      _user = _loadSession();
      return _user;
    },

    /** Logout */
    logout: function() {
      _user = null;
      try { sessionStorage.removeItem(SESSION_KEY); } catch(e) {}
      try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
    },

    /** Refresh user data from server */
    refreshUser: function() {
      var user = TrailAPI.currentUser();
      if (!user) return Promise.resolve(null);
      return _get({ action: 'getUser', userId: user.userId })
        .then(function(res) {
          if (res.error) return user;
          _user = res;
          _saveSession(res);
          return res;
        });
    },

    // === Classes ===

    /** Get available classes */
    getClasses: function() {
      return _get({ action: 'getClasses' })
        .then(function(res) { return res.classes || []; });
    },

    // === Scores ===

    /** Save a game score */
    saveScore: function(gameId, score, correct, total) {
      var user = TrailAPI.currentUser();
      if (!user) {
        // Guest mode — save locally only
        _saveLocalScore(gameId, score, correct, total);
        return Promise.resolve({ altEarned: 0, totalAlt: 0, guest: true });
      }
      return _post({
        action: 'saveScore',
        userId: user.userId,
        gameId: gameId,
        score: score,
        correct: correct,
        total: total
      }).then(function(res) {
        if (!res.error) {
          // Update local user ALT
          _user.totalAlt = res.totalAlt;
          _saveSession(_user);
        }
        return res;
      });
    },

    // === Rankings ===

    /** Get rankings (global or per game) */
    getRankings: function(gameId, limit) {
      var params = { action: 'getRankings', limit: limit || 20 };
      if (gameId) params.gameId = gameId;
      return _get(params)
        .then(function(res) { return res.rankings || []; });
    },

    // === History ===

    /** Get ALT/score history */
    getHistory: function(limit) {
      var user = TrailAPI.currentUser();
      if (!user) return Promise.resolve([]);
      return _get({ action: 'getHistory', userId: user.userId, limit: limit || 30 })
        .then(function(res) { return res.history || []; });
    },

    // === Stats ===

    /** Get global stats */
    getGlobalStats: function() {
      return _get({ action: 'getGlobalStats' });
    },

    // === Local Fallback ===

    /** Get local score history (for guest mode or offline) */
    getLocalHistory: function(gameId) {
      try {
        var raw = localStorage.getItem('trail:history:' + gameId);
        return raw ? JSON.parse(raw) : [];
      } catch(e) { return []; }
    },

    getLocalBestScore: function(gameId) {
      var h = TrailAPI.getLocalHistory(gameId);
      if (!h.length) return null;
      var best = h[0];
      for (var i = 1; i < h.length; i++) {
        if ((h[i].score || 0) > (best.score || 0)) best = h[i];
      }
      return best;
    }
  };

  // === Internal Helpers ===

  function _get(params) {
    if (!_gasUrl) return Promise.resolve({ error: 'GAS not configured' });
    var url = _gasUrl + '?' + _serialize(params);
    return fetch(url)
      .then(function(r) { return r.json(); })
      .catch(function(e) { return { error: e.message }; });
  }

  function _post(body) {
    if (!_gasUrl) return Promise.resolve({ error: 'GAS not configured' });
    return fetch(_gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body)
    })
      .then(function(r) { return r.json(); })
      .catch(function(e) { return { error: e.message }; });
  }

  function _serialize(obj) {
    var parts = [];
    for (var k in obj) {
      if (obj[k] !== undefined && obj[k] !== null) {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
      }
    }
    return parts.join('&');
  }

  function _saveSession(user) {
    try {
      var data = JSON.stringify(user);
      sessionStorage.setItem(SESSION_KEY, data);
      localStorage.setItem(SESSION_KEY, data);
    } catch(e) {}
  }

  function _loadSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function _saveLocalScore(gameId, score, correct, total) {
    var key = 'trail:history:' + gameId;
    try {
      var h = JSON.parse(localStorage.getItem(key) || '[]');
      h.unshift({ score: score, correct: correct, total: total, timestamp: Date.now() });
      if (h.length > 50) h = h.slice(0, 50);
      localStorage.setItem(key, JSON.stringify(h));
    } catch(e) {}
  }

  global.TrailAPI = TrailAPI;
})(typeof window !== 'undefined' ? window : this);
