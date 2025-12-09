async function setup() {
  const rootElem = document.getElementById("root");
  const episodeTemplate = document.getElementById("episodeTemplate");
  const searchInput = document.getElementById("searchInput");
  const episodeCount = document.getElementById("episodeCount");

  // FIX: These must be defined BEFORE you use them
  const showSelect = document.getElementById("showSelect");
  const episodeSelect = document.getElementById("episodeSelect");

  const allEpisodes = await getAllEpisodes(rootElem);

  makePageForEpisodes(allEpisodes, rootElem, episodeTemplate);

  episodeCount.textContent = `${allEpisodes.length} / ${allEpisodes.length}`;

  // LIVE SEARCH FUNCTIONALITY
  searchInput.addEventListener("input", () => {
    const searchTerm = searchInput.value.trim().toLowerCase();

    // CLEAR SEARCH = SHOW ALL
    if (searchTerm === "") {
      rootElem.innerHTML = "";
      makePageForEpisodes(allEpisodes, rootElem, episodeTemplate);
      episodeCount.textContent = `${allEpisodes.length} / ${allEpisodes.length}`;
      return;
    }

    // FILTER EPISODES BASED ON SEARCH TERM
    const filteredEpisodes = allEpisodes.filter((episode) => {
      const nameMatch = (episode.name || "").toLowerCase().includes(searchTerm);

      const summaryText = episode.summary
        ? getTextFromHTML(episode.summary)
        : "";
      const summaryMatch = summaryText.toLowerCase().includes(searchTerm);

      return nameMatch || summaryMatch;
    });
    rootElem.innerHTML = "";
    makePageForEpisodes(filteredEpisodes, rootElem, episodeTemplate);

    episodeCount.textContent = `${filteredEpisodes.length} / ${allEpisodes.length}`;
  });

  showSelect.addEventListener("change", async () => {
    const selectedShowId = showSelect.value;

    if (selectedShowId === "selectShow") return;

    // Fetch episodes for the selected show
    const url = `https://api.tvmaze.com/shows/${selectedShowId}/episodes`;

    rootElem.innerHTML = "Loading...";

    try {
      const response = await fetch(url);
      const episodes = await response.json();

      // Replace your full episode list with the new one
      allEpisodes.length = 0;
      allEpisodes.push(...episodes);

      // Rebuild the episode dropdown
      episodeSelect.innerHTML = `<option value="all">All Episodes</option>`;
      episodes.forEach((ep, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent =
          getEpisodeCode(ep.season, ep.number) + " - " + ep.name;
        episodeSelect.appendChild(option);
      });

      // Render all
      rootElem.innerHTML = "";
      makePageForEpisodes(episodes, rootElem, episodeTemplate);

      // Update count
      episodeCount.textContent = `${episodes.length} / ${episodes.length}`;

      // Re-enable searching
      searchInput.disabled = false;
      searchInput.value = "";
      searchInput.classList.remove("search-disabled");
      searchInput.classList.add("search-enabled");
    } catch (error) {
      console.error("Error fetching show episodes:", error);
      rootElem.innerHTML = "Failed to load episodes.";
    }
  });

  // DROPDOWN TO SELECT EPISODE
  allEpisodes.forEach((episode, index) => {
    const option = document.createElement("option");
    option.value = index;

    // ONLY show season and episode number
    option.textContent =
      getEpisodeCode(episode.season, episode.number) + ` - ` + episode.name;

    episodeSelect.appendChild(option);
  });

  episodeSelect.addEventListener("change", () => {
    const selectedIndex = episodeSelect.value;

    // SHOW ALL EPISODES IF "ALL EPISODES" IS SELECTED
    if (selectedIndex === "all") {
      rootElem.innerHTML = "";
      makePageForEpisodes(allEpisodes, rootElem, episodeTemplate);
      episodeCount.textContent = `${allEpisodes.length} / ${allEpisodes.length}`;
      // Enable search
      searchInput.disabled = false;
      searchInput.classList.remove("search-disabled");
      searchInput.classList.add("search-enabled");
      searchInput.placeholder = "Type to search...";
      return;
    }

    // SHOW SELECTED EPISODE
    const selectedEpisode = allEpisodes[selectedIndex];
    rootElem.innerHTML = "";
    makePageForEpisodes([selectedEpisode], rootElem, episodeTemplate);
    episodeCount.textContent = `1 / ${allEpisodes.length}`;
    // Disable search
    searchInput.disabled = true;
    searchInput.classList.remove("search-enabled");
    searchInput.classList.add("search-disabled");
    searchInput.placeholder = 'Select "All Episodes" to search';
    searchInput.value = "";
  });
}

function makePageForEpisodes(episodeList, rootElem, episodeTemplate) {
  const episodeCards = episodeList.map((episode) =>
    makeCard(episode, episodeTemplate)
  );
  rootElem.append(...episodeCards);
}

function makeCard(episode, episodeTemplate) {
  const episodeCard = episodeTemplate.content.cloneNode(true);
  const episodeName = episodeCard.querySelector(".episodeName");
  const episodeCode = episodeCard.querySelector(".episodeCode");
  const episodeImage = episodeCard.querySelector(".episodeImage");
  const episodeLink = episodeCard.querySelector(".episodeLink");
  const episodeSummary = episodeCard.querySelector(".episodeSummary");

  // Validate required fields
  episodeName.textContent = episode.name || "Unknown Episode";
  episodeCode.textContent =
    episode.season && episode.number
      ? getEpisodeCode(episode.season, episode.number)
      : "N/A";

  episodeImage.src = episode.image?.medium
    ? episode.image.medium
    : "https://placehold.co/250x140?text=NO+IMAGE+AVAILABLE";
  episodeImage.alt = episode.image?.medium
    ? `${episode.name} thumbnail`
    : "No image available";

  episodeLink.href = episode.url || "#";

  episodeSummary.textContent = episode.summary
    ? getTextFromHTML(episode.summary)
    : "No summary available.";

  return episodeCard;
}

function getEpisodeCode(season, episode) {
  // Validate that season and episode are valid numbers
  const validSeason = Number.isInteger(season) && season > 0 ? season : 0;
  const validEpisode = Number.isInteger(episode) && episode > 0 ? episode : 0;

  return `S${String(validSeason).padStart(2, "0")}E${String(
    validEpisode
  ).padStart(2, "0")}`;
}

function getTextFromHTML(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
}

// Fetches all episodes from the TVMaze API
async function getAllEpisodes(rootElem) {
  const showSelect = document.getElementById("showSelect");

  // FETCH ALL SHOWS
  const allShows = await getAllShows();

  // SORT SHOWS ALPHABETICALLY
  allShows.sort((a, b) => a.name.localeCompare(b.name));

  // POPULATE SHOW DROPDOWN
  allShows.forEach((show) => {
    const option = document.createElement("option");
    option.value = show.id; // important!
    option.textContent = show.name;
    showSelect.appendChild(option);
  });

  // Set the first show as default
  if (allShows.length > 0) {
    showSelect.value = allShows[0].id; // <-- select the first show
  }

  const loadingContainer = document.createElement("div");
  loadingContainer.className = "loading-container";

  const spinner = document.createElement("div");
  spinner.className = "spinner";
  loadingContainer.appendChild(spinner);

  const loadingText = document.createElement("p");
  loadingText.textContent = "Loading episodes, please wait...";
  loadingContainer.appendChild(loadingText);

  rootElem.innerHTML = "";
  rootElem.appendChild(loadingContainer);

  try {
    const url = `https://api.tvmaze.com/shows/${showSelect.value}/episodes`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    rootElem.innerHTML = "";
    return data;
  } catch (error) {
    console.error("Failed to fetch episodes:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const retryButton = document.createElement("button");
    retryButton.textContent = "Retry";
    retryButton.className = "retry-button";
    retryButton.onclick = () => window.location.reload();

    const errorContainer = document.createElement("div");
    errorContainer.className = "error-container";

    const errorMsg = document.createElement("p");
    errorMsg.textContent = "Failed to load episodes. Please try again later.";
    errorContainer.appendChild(errorMsg);

    const errorDetails = document.createElement("p");
    errorDetails.className = "error-details";
    errorDetails.textContent = `Error details: ${errorMessage}`;
    errorContainer.appendChild(errorDetails);

    errorContainer.appendChild(retryButton);

    rootElem.innerHTML = "";
    rootElem.appendChild(errorContainer);

    return [];
  }
}

// Fetches all shows from the TVMaze API
async function getAllShows() {
  const url = "https://api.tvmaze.com/shows?page=0";

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.status);

    return await response.json();
  } catch (err) {
    console.error("Failed to fetch shows:", err);
    return [];
  }
}

window.onload = setup;
