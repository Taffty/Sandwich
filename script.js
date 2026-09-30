const counterElement = document.getElementById("counter");
const sandwichButton = document.getElementById("sandwichButton");
const rebirthButton = document.getElementById("rebirthButton");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const statusMessage = document.getElementById("statusMessage");

const REBIRTH_REQUIREMENT = 50;

// Load saved progress when the page opens.
let count = Number(localStorage.getItem("sandwichCount")) || 0;
let rebirths = Number(localStorage.getItem("sandwichRebirths")) || 0;

function saveProgress() {
  localStorage.setItem("sandwichCount", String(count));
  localStorage.setItem("sandwichRebirths", String(rebirths));
}

function updatePage() {
  counterElement.textContent = count.toLocaleString();

  const progress = Math.min((count / REBIRTH_REQUIREMENT) * 100, 100);
  progressBar.style.width = progress + "%";
  progressText.textContent = `${Math.min(count, REBIRTH_REQUIREMENT)} / ${REBIRTH_REQUIREMENT} sandwiches`;

  // Only show the rebirth button after the player has earned 50 sandwiches.
  rebirthButton.style.display = count >= REBIRTH_REQUIREMENT ? "block" : "none";

  if (count >= REBIRTH_REQUIREMENT) {
    statusMessage.textContent = "Rebirth unlocked! Click the button to reset your count.";
  } else {
    statusMessage.textContent = `You need ${REBIRTH_REQUIREMENT - count} more sandwich${REBIRTH_REQUIREMENT - count === 1 ? "" : "es"} to unlock rebirth.`;
  }
}

sandwichButton.addEventListener("click", () => {
  count++;
  saveProgress();
  updatePage();
});

rebirthButton.addEventListener("click", () => {
  if (count < REBIRTH_REQUIREMENT) return;

  count = 0;
  rebirths++;
  saveProgress();
  updatePage();

  statusMessage.textContent = `Rebirth complete! You've rebirthed ${rebirths} time${rebirths === 1 ? "" : "s"}. Start clicking again!`;
});

updatePage();


/*
function downloadSave() {
  const saveData = `${count}\n${rebirths}`;

  const blob = new Blob([saveData], {
    type: "text/plain"
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "sandwich-save.txt";
  link.click();

  URL.revokeObjectURL(url);
}


function loadSave(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(event) {
    const lines = event.target.result.trim().split(/\r?\n/);

    count = Number(lines[0]);
    rebirths = Number(lines[1]);

    saveProgress();
    updatePage();
  };

  reader.readAsText(file);
}




in HTML
<button onclick="downloadSave()">Download Save</button>

<input type="file" accept=".txt" onchange="loadSave(this.files[0])">
*/


