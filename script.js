// SANDWICH CLICKER - game logic
const SAVE_KEY = "sandwichClickerSave_v2";
const THEME_KEY = "sandwichClickerTheme";
const BASE_REBIRTH_REQUIREMENT = 50;
const AUTOCLICK_INTERVAL = 1000;

const $ = (id) => document.getElementById(id);
const el = {
  sandwichButton: $("sandwichButton"), rebirthButton: $("rebirthButton"),
  sandwichCount: $("sandwichCount"), rebirthCount: $("rebirthCount"),
  progressFill: $("progressFill"), progressText: $("progressText"),
  progressCaption: $("progressCaption"), rebirthHint: $("rebirthHint"),
  toast: $("toast"), darkModeToggle: $("darkModeToggle")
};

let game = loadGame();
let toastTimer;

function freshGame() {
  return { sandwiches: 0, rebirths: 0, upgrades: { double: 0, auto: 0, luck: 0 } };
}

function loadGame() {
  try {
    const currentSave = localStorage.getItem(SAVE_KEY);
    const legacySave = localStorage.getItem("sandwichClickerSave_v1");
    const saved = JSON.parse(currentSave || legacySave || "null");
    if (saved && Number.isFinite(saved.sandwiches) && Number.isFinite(saved.rebirths)) {
      return {
        sandwiches: Math.max(0, Math.floor(saved.sandwiches)),
        rebirths: Math.max(0, Math.floor(saved.rebirths)),
        upgrades: {
          double: Math.max(0, Math.floor(saved.upgrades?.double || 0)),
          auto: Math.max(0, Math.floor(saved.upgrades?.auto || 0)),
          luck: Math.max(0, Math.floor(saved.upgrades?.luck || 0))
        }
      };
    }
  } catch (error) { console.warn("Save could not be loaded:", error); }
  return freshGame();
}

function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); }
  catch (error) { console.error("Save failed:", error); showToast("Could not save. Check browser storage."); }
}

function rebirthRequirement() {
  // Each rebirth adds another 50 sandwiches to the next goal.
  return BASE_REBIRTH_REQUIREMENT * (game.rebirths + 1);
}

function upgradeCost(type) {
  const level = game.upgrades[type];
  const costs = {
    double: 25 * (level + 1),
    auto: 50 * (level + 1),
    luck: 30 * (level + 1)
  };
  return costs[type];
}

function renderUpgrade(type) {
  const level = game.upgrades[type];
  const cost = upgradeCost(type);
  const costEl = $(`${type}Cost`);
  const levelEl = $(`${type}Level`);
  const button = $(`${type}UpgradeButton`);
  if (costEl) costEl.textContent = cost.toLocaleString();
  if (levelEl) levelEl.textContent = level;
  if (button) button.disabled = game.sandwiches < cost;
}

function updateDisplay() {
  const goal = rebirthRequirement();
  const progress = Math.min(game.sandwiches / goal, 1) * 100;
  el.sandwichCount.textContent = game.sandwiches.toLocaleString();
  el.rebirthCount.textContent = game.rebirths.toLocaleString();
  el.progressFill.style.width = `${progress}%`;
  el.progressText.textContent = `${Math.min(game.sandwiches, goal).toLocaleString()} / ${goal.toLocaleString()}`;

  const remaining = Math.max(0, goal - game.sandwiches);
  el.rebirthButton.disabled = remaining > 0;
  el.rebirthHint.textContent = remaining === 0
    ? "Ready! Rebirth to start fresh and increase your bonus."
    : `${remaining.toLocaleString()} more sandwiches needed.`;
  el.progressCaption.textContent = remaining === 0
    ? "Goal reached! Your rebirth is ready."
    : `${remaining.toLocaleString()} more sandwiches needed for your next rebirth.`;

  $("sandwichRank").textContent = game.sandwiches.toLocaleString();
  $("rebirthRank").textContent = game.rebirths.toLocaleString();
  $("profileSandwiches").textContent = game.sandwiches.toLocaleString();
  $("profileRebirths").textContent = game.rebirths.toLocaleString();

  $("doubleEffect").textContent = `${2 ** game.upgrades.double}x sandwiches per click`;
  $("autoEffect").textContent = `${game.upgrades.auto} sandwich(es) per second`;
  $("luckEffect").textContent = `${Math.min(100, game.upgrades.luck * 5)}% critical chance`;
  ["double", "auto", "luck"].forEach(renderUpgrade);
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
}

function earnSandwiches(amount, message = "") {
  game.sandwiches += amount;
  saveGame();
  updateDisplay();
  if (message) showToast(message);
}

el.sandwichButton.addEventListener("click", () => {
  const baseAmount = 2 ** game.upgrades.double;
  const criticalChance = Math.min(0.75, game.upgrades.luck * 0.05);
  const critical = Math.random() < criticalChance;
  const earned = critical ? baseAmount * 2 : baseAmount;
  earnSandwiches(earned, critical ? `CRITICAL CLICK! +${earned} sandwiches!` : "");
});

function buyUpgrade(type) {
  const cost = upgradeCost(type);
  if (game.sandwiches < cost) {
    showToast("You need more sandwiches for that upgrade.");
    return;
  }
  game.sandwiches -= cost;
  game.upgrades[type] += 1;
  saveGame();
  updateDisplay();
  const names = { double: "2x Click", auto: "Autoclicker", luck: "Luck" };
  showToast(`${names[type]} upgraded!`);
}

$("doubleUpgradeButton").addEventListener("click", () => buyUpgrade("double"));
$("autoUpgradeButton").addEventListener("click", () => buyUpgrade("auto"));
$("luckUpgradeButton").addEventListener("click", () => buyUpgrade("luck"));

el.rebirthButton.addEventListener("click", () => {
  if (game.sandwiches < rebirthRequirement()) return;
  game.sandwiches = 0;
  game.rebirths += 1;
  game.upgrades = { double: 0, auto: 0, luck: 0 };
  saveGame();
  updateDisplay();
  showToast(`Rebirth ${game.rebirths} complete! Upgrades reset. Next goal: ${rebirthRequirement()} sandwiches.`);
});

// Autoclickers earn one sandwich per second per autoclicker level.
setInterval(() => {
  if (game.upgrades.auto > 0) {
    earnSandwiches(game.upgrades.auto);
  }
}, AUTOCLICK_INTERVAL);

$("settingsButton").addEventListener("click", () => $("settingsDialog").showModal());
$("profileButton").addEventListener("click", () => $("profileDialog").showModal());

// Light/dark theme: CSS variables handle the whole interface.
function applyTheme(isDark) {
  document.body.classList.toggle("dark-mode", isDark);
  el.darkModeToggle.checked = isDark;
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
}
el.darkModeToggle.addEventListener("change", () => applyTheme(el.darkModeToggle.checked));
applyTheme(localStorage.getItem(THEME_KEY) === "dark");

// Reset all game stats, upgrades, and rebirths.
$("resetAllButton").addEventListener("click", () => {
  if (!confirm("Reset EVERYTHING? Sandwiches, rebirths, and all upgrades will return to zero. This cannot be undone.")) return;
  game = freshGame();
  saveGame();
  updateDisplay();
  $("settingsDialog").close();
  showToast("All game data has been reset.");
});

// Keep compatibility with any old reset button ID in a customized copy.
const oldReset = $("resetButton");
if (oldReset) oldReset.addEventListener("click", () => $("resetAllButton").click());

updateDisplay();
