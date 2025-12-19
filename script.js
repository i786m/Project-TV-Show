// App state storage
const state = {
	allShows: null,
	episodeCache: {},

	currentView: 'shows',
	selectedShow: null,

	showSearchTerm: '',
	episodeSearchTerm: '',
	selectedEpisodeIndex: 'all',

	filteredShows: [],
	filteredEpisodes: [],

	isLoading: false,
	error: null,
	isEpisodeSearchEnabled: true,
	isShowSearchEnabled: true,
};

// Bootstraps the app: fetch shows, then wire UI listeners
async function setup() {
	const rootElem = document.getElementById('root');
	const searchInput = document.getElementById('search-input');
	const displayCount = document.getElementById('display-count');
	const showSelect = document.getElementById('show-select');
	const episodeSelect = document.getElementById('episode-select');
	const backToShowsButton = document.getElementById('back-to-shows');
	const showTemplate = document.getElementById('show-template');
	const episodeTemplate = document.getElementById('episode-template');

	state.isLoading = true;
	renderLoading(rootElem);

	try {
		state.allShows = await fetchAllShows();
		// Sort shows alphabetically (case-insensitive) for the dropdown
		state.allShows.sort((a, b) => {
			const aName = (a.name || '').toLowerCase();
			const bName = (b.name || '').toLowerCase();
			return aName.localeCompare(bName);
		});
		state.filteredShows = state.allShows;

		populateShowDropdown(showSelect, state.allShows);

		state.isLoading = false;
		state.currentView = 'shows';
		render(rootElem, showTemplate, episodeTemplate, displayCount);
	} catch (error) {
		state.error = error;
		state.isLoading = false;
		renderError(rootElem, error);
		return;
	}

	backToShowsButton.addEventListener('click', () => {
		state.currentView = 'shows';
		state.selectedShow = null;
		state.episodeSearchTerm = '';
		state.selectedEpisodeIndex = 'all';
		searchInput.value = state.showSearchTerm;
		render(rootElem, showTemplate, episodeTemplate, displayCount);
	});

	searchInput.addEventListener('input', () => {
		const searchTerm = searchInput.value.trim().toLowerCase();

		if (state.currentView === 'shows') {
			state.showSearchTerm = searchTerm;
			applyShowFilters();
		} else {
			state.episodeSearchTerm = searchTerm;
			applyEpisodeFilters();
		}

		render(rootElem, showTemplate, episodeTemplate, displayCount);
	});

	showSelect.addEventListener('change', () => {
		const selectedId = showSelect.value;

		if (selectedId === 'all') {
			state.filteredShows = state.allShows;
			state.isShowSearchEnabled = true;
			render(rootElem, showTemplate, episodeTemplate, displayCount);
		} else {
			const show = state.allShows.find((s) => s.id == selectedId);
			if (show) {
				state.filteredShows = [show];
				state.isShowSearchEnabled = false;
				render(rootElem, showTemplate, episodeTemplate, displayCount);
			}
		}
	});

	episodeSelect.addEventListener('change', () => {
		state.selectedEpisodeIndex = episodeSelect.value;
		applyEpisodeFilters();
		render(rootElem, showTemplate, episodeTemplate, displayCount);
	});
}

// Central render: chooses view and updates counts
function render(rootElem, showTemplate, episodeTemplate, displayCount) {
	rootElem.innerHTML = '';

	if (state.isLoading) {
		renderLoading(rootElem);
		return;
	}

	if (state.error) {
		renderError(rootElem, state.error);
		return;
	}

	updateHeader();

	if (state.currentView === 'shows') {
		renderShowsView(rootElem, showTemplate);
		updateDisplayCount(
			displayCount,
			state.filteredShows.length,
			state.allShows.length,
			'shows'
		);
	} else {
		renderEpisodesView(rootElem, episodeTemplate);
		const allEpisodes = state.episodeCache[state.selectedShow.id] || [];
		updateDisplayCount(
			displayCount,
			state.filteredEpisodes.length,
			allEpisodes.length,
			'episodes'
		);
	}
}

// Build the shows view
function renderShowsView(rootElem, showTemplate) {
	const fragment = document.createDocumentFragment();
	const shows =
		state.filteredShows.length > 0 ? state.filteredShows : state.allShows;
	// Render shows in case-insensitive alphabetical order (matches dropdown)
	const sortedShows = [...shows].sort((a, b) => {
		const aName = (a.name || '').toLowerCase();
		const bName = (b.name || '').toLowerCase();
		return aName.localeCompare(bName);
	});

	sortedShows.forEach((show) => {
		const card = makeShowCard(show, showTemplate);
		fragment.appendChild(card);
	});

	rootElem.appendChild(fragment);
}

// Build the episodes view
function renderEpisodesView(rootElem, episodeTemplate) {
	const fragment = document.createDocumentFragment();
	const episodes = state.filteredEpisodes;

	episodes.forEach((episode) => {
		const card = makeEpisodeCard(episode, episodeTemplate);
		fragment.appendChild(card);
	});

	rootElem.appendChild(fragment);
}

// Create one show card with click/keyboard handlers
function makeShowCard(show, showTemplate) {
	const card = showTemplate.content.cloneNode(true);
	const article = card.querySelector('.show-card');

	article.dataset.showId = show.id;
	article.tabIndex = 0;
	article.setAttribute('role', 'button');

	const showName = card.querySelector('.show-name');
	const showImage = card.querySelector('.show-image');
	const showSummary = card.querySelector('.show-summary');
	const showRating = card.querySelector('.show-rating');
	const showGenres = card.querySelector('.show-genres');
	const showStatus = card.querySelector('.show-status');
	const showRuntime = card.querySelector('.show-runtime');

	showName.textContent = show.name || 'Unknown Show';
	showImage.src =
		show.image?.medium || 'https://placehold.co/210x295?text=NO+IMAGE';
	showImage.alt = `${show.name || 'Show'} poster`;
	showSummary.innerHTML = show.summary || 'No summary available.';
	showRating.textContent = show.rating?.average || 'N/A';
	showGenres.textContent =
		Array.isArray(show.genres) && show.genres.length
			? show.genres.join(' | ')
			: 'N/A';
	showStatus.textContent = show.status || 'Unknown';
	showRuntime.textContent = show.runtime || 'N/A';

	article.addEventListener('click', () => selectShow(show));
	article.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			selectShow(show);
		}
	});

	return card;
}

// Create one episode card
function makeEpisodeCard(episode, episodeTemplate) {
	const card = episodeTemplate.content.cloneNode(true);

	const episodeName = card.querySelector('.episode-name');
	const episodeCode = card.querySelector('.episode-code');
	const episodeImage = card.querySelector('.episode-image');
	const episodeLink = card.querySelector('.episode-link');
	const episodeSummary = card.querySelector('.episode-summary');

	episodeName.textContent = episode.name || 'Unknown Episode';
	episodeCode.textContent =
		episode.season && episode.number
			? getEpisodeCode(episode.season, episode.number)
			: 'N/A';
	episodeImage.src =
		episode.image?.medium || 'https://placehold.co/250x140?text=NO+IMAGE';
	episodeImage.alt = episode.image?.medium
		? `${episode.name} thumbnail`
		: 'No image available';
	episodeLink.href = episode.url || '#';
	episodeSummary.textContent = episode.summary
		? getTextFromHTML(episode.summary)
		: 'No summary available.';

	return card;
}

// Switch to episodes view; fetch and cache episodes as needed
async function selectShow(show) {
	state.selectedShow = show;
	state.currentView = 'episodes';
	state.episodeSearchTerm = '';
	state.selectedEpisodeIndex = 'all';

	const rootElem = document.getElementById('root');
	const showTemplate = document.getElementById('show-template');
	const episodeTemplate = document.getElementById('episode-template');
	const displayCount = document.getElementById('display-count');
	const searchInput = document.getElementById('search-input');

	if (!state.episodeCache[show.id]) {
		state.isLoading = true;
		render(rootElem, showTemplate, episodeTemplate, displayCount);

		try {
			state.episodeCache[show.id] = await fetchEpisodesByShowId(show.id);
			state.isLoading = false;
		} catch (error) {
			state.error = error;
			state.isLoading = false;
			renderError(rootElem, error);
			return;
		}
	}

	populateEpisodeDropdown(state.episodeCache[show.id]);

	applyEpisodeFilters();
	searchInput.value = '';
	render(rootElem, showTemplate, episodeTemplate, displayCount);
}

// Toggle header controls for the active view
function updateHeader() {
	const showSelectLabel = document.querySelector('label[for="show-select"]');
	const episodeSelectLabel = document.querySelector(
		'label[for="episode-select"]'
	);
	const backToShowsButton = document.getElementById('back-to-shows');
	const searchInput = document.getElementById('search-input');

	if (state.currentView === 'shows') {
		showSelectLabel.style.display = '';
		episodeSelectLabel.style.display = 'none';
		backToShowsButton.style.display = 'none';
		backToShowsButton.style.visibility = 'hidden';
		searchInput.placeholder = state.isShowSearchEnabled
			? 'Search shows...'
			: 'Select "All Shows" to search';
		searchInput.disabled = !state.isShowSearchEnabled;
		if (state.isShowSearchEnabled) {
			searchInput.classList.remove('search-disabled');
			searchInput.classList.add('search-enabled');
		} else {
			searchInput.classList.remove('search-enabled');
			searchInput.classList.add('search-disabled');
		}
	} else {
		showSelectLabel.style.display = 'none';
		episodeSelectLabel.style.display = '';
		backToShowsButton.style.display = '';
		backToShowsButton.style.visibility = 'visible';
		searchInput.placeholder = state.isEpisodeSearchEnabled
			? 'Search episodes...'
			: 'Select "All Episodes" to search';
		searchInput.disabled = !state.isEpisodeSearchEnabled;
		if (state.isEpisodeSearchEnabled) {
			searchInput.classList.remove('search-disabled');
			searchInput.classList.add('search-enabled');
		} else {
			searchInput.classList.remove('search-enabled');
			searchInput.classList.add('search-disabled');
		}
	}
}

// Populate the shows dropdown once
function populateShowDropdown(showSelect, shows) {
	showSelect.innerHTML = '<option value="all">All Shows</option>';
	shows.forEach((show) => {
		const option = document.createElement('option');
		option.value = show.id;
		option.textContent = show.name;
		showSelect.appendChild(option);
	});
}

// Populate the episodes dropdown for the selected show
function populateEpisodeDropdown(episodes) {
	const episodeSelect = document.getElementById('episode-select');
	episodeSelect.innerHTML = '<option value="all">All Episodes</option>';

	episodes.forEach((episode, index) => {
		const option = document.createElement('option');
		option.value = index;
		option.textContent = `${getEpisodeCode(
			episode.season,
			episode.number
		)} - ${episode.name}`;
		episodeSelect.appendChild(option);
	});
}

// Filter shows by search text
function applyShowFilters() {
	const query = state.showSearchTerm.toLowerCase().trim();

	if (!query) {
		state.filteredShows = state.allShows;
		return;
	}

	state.filteredShows = state.allShows.filter((show) => {
		const name = (show.name || '').toLowerCase();
		const genres = (
			Array.isArray(show.genres) ? show.genres.join(' ') : ''
		).toLowerCase();
		const summary = getTextFromHTML(show.summary || '').toLowerCase();
		return (
			name.includes(query) ||
			genres.includes(query) ||
			summary.includes(query)
		);
	});

	// Keep filtered show results in alphabetical order
	state.filteredShows.sort((a, b) => {
		const aName = (a.name || '').toLowerCase();
		const bName = (b.name || '').toLowerCase();
		return aName.localeCompare(bName);
	});
}

// Filter episodes by search text or dropdown selection
function applyEpisodeFilters() {
	if (!state.selectedShow) return;

	const allEpisodes = state.episodeCache[state.selectedShow.id] || [];
	const query = state.episodeSearchTerm.toLowerCase().trim();

	let filtered = allEpisodes;

	if (query) {
		filtered = filtered.filter((ep) => {
			const name = (ep.name || '').toLowerCase();
			const summary = getTextFromHTML(ep.summary || '').toLowerCase();
			return name.includes(query) || summary.includes(query);
		});
	}

	if (state.selectedEpisodeIndex !== 'all') {
		const index = Number(state.selectedEpisodeIndex);
		if (
			Number.isInteger(index) &&
			index >= 0 &&
			index < allEpisodes.length
		) {
			filtered = [allEpisodes[index]];
			state.isEpisodeSearchEnabled = false;
		} else {
			state.isEpisodeSearchEnabled = true;
		}
	} else {
		state.isEpisodeSearchEnabled = true;
	}

	state.filteredEpisodes = filtered;
}

// Update the visible count indicator
function updateDisplayCount(displayCount, filtered, total, type) {
	displayCount.textContent = `${filtered} / ${total} ${type}`;
}

// API: fetch all shows once
async function fetchAllShows() {
	const url = 'https://api.tvmaze.com/shows?page=0';
	const response = await fetch(url);
	if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
	return await response.json();
}

// API: fetch episodes for a specific show
async function fetchEpisodesByShowId(showId) {
	const url = `https://api.tvmaze.com/shows/${showId}/episodes`;
	const response = await fetch(url);
	if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
	return await response.json();
}

// Format SxxEyy labels
function getEpisodeCode(season, episode) {
	const validSeason = Number.isInteger(season) && season > 0 ? season : 0;
	const validEpisode = Number.isInteger(episode) && episode > 0 ? episode : 0;
	return `S${String(validSeason).padStart(2, '0')}E${String(
		validEpisode
	).padStart(2, '0')}`;
}

// Strip HTML to plain text
function getTextFromHTML(html) {
	const temp = document.createElement('div');
	temp.innerHTML = html;
	return temp.textContent || temp.innerText || '';
}

// Render loading UI
function renderLoading(rootElem) {
	const container = document.createElement('div');
	container.className = 'loading-container';

	const spinner = document.createElement('div');
	spinner.className = 'spinner';
	container.appendChild(spinner);

	const text = document.createElement('p');
	text.textContent = 'Loading, please wait...';
	container.appendChild(text);

	rootElem.innerHTML = '';
	rootElem.appendChild(container);
}

// Render error UI
function renderError(rootElem, error) {
	console.error('Rendering error:', error);
	const container = document.createElement('div');
	container.className = 'error-container';

	const msg = document.createElement('p');
	msg.textContent = 'Failed to load. Please try again.';
	container.appendChild(msg);

	const details = document.createElement('p');
	details.className = 'error-details';
	details.textContent = `Error: ${
		error instanceof Error ? error.message : String(error)
	}`;
	container.appendChild(details);

	const btn = document.createElement('button');
	btn.className = 'retry-button';
	btn.textContent = 'Retry';
	btn.onclick = () => window.location.reload();
	container.appendChild(btn);

	rootElem.innerHTML = '';
	rootElem.appendChild(container);
}

const backToTopBtn = document.getElementById('back-to-top');

// Back to top button visibility and click behavior
window.addEventListener('scroll', () => {
	if (window.scrollY > 300) {
		backToTopBtn.classList.add('visible');
	} else {
		backToTopBtn.classList.remove('visible');
	}
});

backToTopBtn.addEventListener('click', () => {
	window.scrollTo({
		top: 0,
		behavior: 'smooth',
	});
});

// Initialize app on window load
window.onload = setup;