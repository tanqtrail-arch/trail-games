/**
 * TRAIL SDK - Game ↔ Platform Communication
 *
 * Drop this script into any game to enable communication with the
 * TRAIL SaaS shell. Games work standalone too — if no shell is
 * detected, all SDK calls are silently ignored.
 *
 * Usage in game HTML:
 *   <script src="../shared/trail-sdk.js"></script>
 *   <script>
 *     TrailSDK.ready({ gameId: 'bunsu-buster' });
 *     // ... later ...
 *     TrailSDK.reportScore({ score: 100, correct: 8, total: 10 });
 *     TrailSDK.gameOver({ score: 100, correct: 8, total: 10 });
 *   </script>
 *
 * Communication Protocol (postMessage):
 *   Game → Shell:
 *     { type: 'trail:ready',     gameId }
 *     { type: 'trail:score',     gameId, data: { score, ... } }
 *     { type: 'trail:gameOver',  gameId, data: { score, ... } }
 *     { type: 'trail:resize',    gameId, height }
 *     { type: 'trail:navigate',  gameId, target: 'home' | gameId }
 *
 *   Shell → Game:
 *     { type: 'trail:init',      config: { ... } }
 *     { type: 'trail:pause' }
 *     { type: 'trail:resume' }
 */
(function(global) {
  'use strict';

  var _gameId = null;
  var _isEmbedded = (window !== window.parent);
  var _listeners = {};

  function _post(msg) {
    if (_isEmbedded && window.parent) {
      try { window.parent.postMessage(msg, '*'); } catch(e) {}
    }
  }

  var TrailSDK = {
    /** Is this game running inside the TRAIL shell? */
    isEmbedded: function() { return _isEmbedded; },

    /** Call when game is loaded and ready */
    ready: function(opts) {
      _gameId = (opts && opts.gameId) || 'unknown';
      _post({ type: 'trail:ready', gameId: _gameId });
    },

    /** Report a score update (mid-game) */
    reportScore: function(data) {
      _post({ type: 'trail:score', gameId: _gameId, data: data });
    },

    /** Report game over with final results */
    gameOver: function(data) {
      _post({ type: 'trail:gameOver', gameId: _gameId, data: data });
      // Also persist to localStorage for standalone play
      _saveLocalHistory(data);
    },

    /** Request navigation (back to home or to another game) */
    navigate: function(target) {
      if (_isEmbedded) {
        _post({ type: 'trail:navigate', gameId: _gameId, target: target });
      } else {
        // Standalone: go to portal
        window.location.href = target === 'home' ? '../' : '../' + target + '/';
      }
    },

    /** Report iframe content height for auto-resize */
    reportHeight: function() {
      if (_isEmbedded) {
        var h = document.documentElement.scrollHeight;
        _post({ type: 'trail:resize', gameId: _gameId, height: h });
      }
    },

    /** Listen for messages from shell */
    on: function(event, callback) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(callback);
    },

    /** Get play history from localStorage */
    getHistory: function(gameId) {
      var id = gameId || _gameId;
      try {
        var raw = localStorage.getItem('trail:history:' + id);
        return raw ? JSON.parse(raw) : [];
      } catch(e) { return []; }
    },

    /** Get best score from localStorage */
    getBestScore: function(gameId) {
      var id = gameId || _gameId;
      var history = TrailSDK.getHistory(id);
      if (history.length === 0) return null;
      var best = history[0];
      for (var i = 1; i < history.length; i++) {
        if (history[i].score > best.score) best = history[i];
      }
      return best;
    }
  };

  function _saveLocalHistory(data) {
    if (!_gameId) return;
    var key = 'trail:history:' + _gameId;
    try {
      var history = JSON.parse(localStorage.getItem(key) || '[]');
      history.unshift({
        score: data.score || 0,
        correct: data.correct,
        total: data.total,
        timestamp: Date.now()
      });
      // Keep last 50 entries
      if (history.length > 50) history = history.slice(0, 50);
      localStorage.setItem(key, JSON.stringify(history));
    } catch(e) {}
  }

  // Listen for messages from shell
  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type.indexOf('trail:') !== 0) return;

    var eventName = msg.type.replace('trail:', '');
    var handlers = _listeners[eventName];
    if (handlers) {
      for (var i = 0; i < handlers.length; i++) {
        try { handlers[i](msg); } catch(err) {}
      }
    }
  });

  global.TrailSDK = TrailSDK;
})(typeof window !== 'undefined' ? window : this);
