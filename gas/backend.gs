/**
 * TRAIL Game Pro - Google Apps Script Backend
 *
 * === セットアップ手順 ===
 * 1. Google Spreadsheet を新規作成
 * 2. 拡張機能 → Apps Script を開く
 * 3. このコードを貼り付け
 * 4. 以下の3つのシートを作成:
 *    - "Users"   (列: userId, name, className, createdAt, lastLogin, totalAlt)
 *    - "Scores"  (列: id, userId, gameId, score, correct, total, altEarned, timestamp)
 *    - "Classes" (列: id, name, order)
 * 5. デプロイ → 新しいデプロイ → ウェブアプリ
 *    - 実行するユーザー: 自分
 *    - アクセスできるユーザー: 全員
 * 6. URLをコピーして trail-api.js の GAS_URL に設定
 *
 * === Classes シート初期データ例 ===
 * id          | name             | order
 * kids        | 探究キッズ        | 1
 * starter     | 探究スターター     | 2
 * basic       | 探究ベーシック     | 3
 * advance     | 探究アドバンス     | 4
 * limitless   | 探究リミットレス   | 5
 * private     | 探究個別          | 6
 */

// === Config ===
var SHEET_USERS = 'Users';
var SHEET_SCORES = 'Scores';
var SHEET_CLASSES = 'Classes';

// === CORS Headers ===
function createResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// === Entry Points ===
function doGet(e) {
  var action = e.parameter.action;
  try {
    switch (action) {
      case 'getClasses':    return createResponse(getClasses());
      case 'getUser':       return createResponse(getUser(e.parameter.userId));
      case 'getRankings':   return createResponse(getRankings(e.parameter.gameId, e.parameter.limit));
      case 'getHistory':    return createResponse(getHistory(e.parameter.userId, e.parameter.limit));
      case 'getGlobalStats': return createResponse(getGlobalStats());
      default:              return createResponse({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return createResponse({ error: err.message });
  }
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var action = body.action;
  try {
    switch (action) {
      case 'login':      return createResponse(login(body));
      case 'saveScore':  return createResponse(saveScore(body));
      default:           return createResponse({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return createResponse({ error: err.message });
  }
}

// === Classes ===
function getClasses() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CLASSES);
  if (!sheet) return { classes: [] };
  var data = sheet.getDataRange().getValues();
  var classes = [];
  for (var i = 1; i < data.length; i++) {
    classes.push({ id: data[i][0], name: data[i][1], order: data[i][2] });
  }
  classes.sort(function(a, b) { return a.order - b.order; });
  return { classes: classes };
}

// === Login / Register ===
function login(body) {
  var name = (body.name || '').trim();
  var className = (body.className || '').trim();
  if (!name || !className) return { error: 'name and className are required' };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  if (!sheet) return { error: 'Users sheet not found' };
  var data = sheet.getDataRange().getValues();
  var now = new Date().toISOString();

  // Find existing user
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === name && data[i][2] === className) {
      // Update lastLogin
      sheet.getRange(i + 1, 5).setValue(now);
      return {
        userId: data[i][0],
        name: data[i][1],
        className: data[i][2],
        totalAlt: data[i][5] || 0
      };
    }
  }

  // Create new user
  var userId = 'u_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  sheet.appendRow([userId, name, className, now, now, 0]);

  return {
    userId: userId,
    name: name,
    className: className,
    totalAlt: 0
  };
}

// === Get User ===
function getUser(userId) {
  if (!userId) return { error: 'userId required' };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      return {
        userId: data[i][0],
        name: data[i][1],
        className: data[i][2],
        totalAlt: data[i][5] || 0
      };
    }
  }
  return { error: 'User not found' };
}

// === Save Score ===
function saveScore(body) {
  var userId = body.userId;
  var gameId = body.gameId;
  var score = body.score || 0;
  var correct = body.correct || 0;
  var total = body.total || 0;

  if (!userId || !gameId) return { error: 'userId and gameId required' };

  // Calculate ALT earned (customize as needed)
  var altEarned = calcAlt(score, correct, total);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SCORES);
  var now = new Date().toISOString();
  var id = 's_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  sheet.appendRow([id, userId, gameId, score, correct, total, altEarned, now]);

  // Update user totalAlt
  updateUserAlt(userId, altEarned);

  return {
    scoreId: id,
    altEarned: altEarned,
    totalAlt: getUserTotalAlt(userId)
  };
}

function calcAlt(score, correct, total) {
  // Base ALT: 10 per game play
  var alt = 10;
  // Bonus for correct answers
  if (total > 0) {
    var ratio = correct / total;
    if (ratio >= 1.0) alt += 30;      // Perfect
    else if (ratio >= 0.8) alt += 20;  // Great
    else if (ratio >= 0.5) alt += 10;  // Good
  }
  // Score bonus
  alt += Math.floor(score / 100) * 5;
  return alt;
}

function updateUserAlt(userId, altEarned) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      var current = data[i][5] || 0;
      sheet.getRange(i + 1, 6).setValue(current + altEarned);
      return;
    }
  }
}

function getUserTotalAlt(userId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === userId) return data[i][5] || 0;
  }
  return 0;
}

// === Rankings ===
function getRankings(gameId, limit) {
  var lim = parseInt(limit) || 20;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SCORES);
  var userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  if (!sheet || !userSheet) return { rankings: [] };

  var scores = sheet.getDataRange().getValues();
  var users = userSheet.getDataRange().getValues();

  // Build user map
  var userMap = {};
  for (var u = 1; u < users.length; u++) {
    userMap[users[u][0]] = { name: users[u][1], className: users[u][2] };
  }

  // Aggregate best scores per user (per game or overall)
  var bestScores = {};
  for (var i = 1; i < scores.length; i++) {
    var sGameId = scores[i][2];
    var sUserId = scores[i][1];
    var sScore = scores[i][3] || 0;

    if (gameId && sGameId !== gameId) continue;

    var key = sUserId + (gameId ? '' : '_' + sGameId);
    if (!bestScores[key] || sScore > bestScores[key].score) {
      bestScores[key] = {
        userId: sUserId,
        gameId: sGameId,
        score: sScore,
        timestamp: scores[i][7]
      };
    }
  }

  // Sort by score desc
  var ranking = Object.values(bestScores);
  ranking.sort(function(a, b) { return b.score - a.score; });
  ranking = ranking.slice(0, lim);

  // Add user info
  for (var r = 0; r < ranking.length; r++) {
    var user = userMap[ranking[r].userId] || { name: '???', className: '' };
    ranking[r].name = user.name;
    ranking[r].className = user.className;
    ranking[r].rank = r + 1;
  }

  return { rankings: ranking };
}

// === ALT History ===
function getHistory(userId, limit) {
  if (!userId) return { error: 'userId required' };
  var lim = parseInt(limit) || 30;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SCORES);
  if (!sheet) return { history: [] };
  var data = sheet.getDataRange().getValues();

  var history = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === userId) {
      history.push({
        gameId: data[i][2],
        score: data[i][3],
        correct: data[i][4],
        total: data[i][5],
        altEarned: data[i][6],
        timestamp: data[i][7]
      });
    }
  }

  history.sort(function(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  return { history: history.slice(0, lim) };
}

// === Global Stats ===
function getGlobalStats() {
  var userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  var scoreSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SCORES);

  var totalUsers = userSheet ? Math.max(0, userSheet.getLastRow() - 1) : 0;
  var totalPlays = scoreSheet ? Math.max(0, scoreSheet.getLastRow() - 1) : 0;

  return {
    totalUsers: totalUsers,
    totalPlays: totalPlays
  };
}
