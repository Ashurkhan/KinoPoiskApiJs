// OMDb API
// ВАЖНО: Для работы приложения нужен бесплатный API ключ!
// Получите его на: http://www.omdbapi.com/apikey.aspx
// 1. Зарегистрируйтесь (бесплатно)
// 2. ПОДТВЕРДИТЕ EMAIL (это обязательно! Ключ не будет работать без подтверждения)
// 3. Скопируйте ключ и вставьте ниже
// 
// ⚠️ Если видите ошибку "Invalid API key!" - проверьте почту и подтвердите регистрацию!
const OMDB_BASE = 'https://www.omdbapi.com/';
const OMDB_KEY = 'ed043f6f'; // Замените на свой API ключ после подтверждения email

// Переменные для элементов
let searchInput;
let movieGrid;
let topMoviesGrid;
let watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
let currentDetailMovie = null; // currently opened movie in detail screen

// Ensure watchlist is an array of valid items (sanitize on load)
function sanitizeWatchlist() {
  let changed = false;
  if (!Array.isArray(watchlist)) {
    watchlist = [];
    changed = true;
  } else {
    // Keep only well-formed entries: require imdbID and non-empty Title
    const filtered = watchlist.filter(item => item && item.imdbID && typeof item.imdbID === 'string' && item.Title && item.Title.toString().trim() !== '');
    if (filtered.length !== watchlist.length) {
      console.log('[movies-app] sanitizeWatchlist: removed', watchlist.length - filtered.length, 'invalid items');
      watchlist = filtered;
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
  }
}

function refreshWatchlistFromStorage() {
  try {
    const raw = localStorage.getItem('watchlist');
    watchlist = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('[movies-app] refreshWatchlistFromStorage parse error', e);
    watchlist = [];
  }
  console.log('[movies-app] watchlist loaded from storage:', watchlist.length, watchlist.map(m => m.imdbID));
}

// === Инициализация ===
document.addEventListener('DOMContentLoaded', () => {
  console.log('[movies-app] DOMContentLoaded');
  // Очистим некорректные записи в watchlist при старте
  sanitizeWatchlist();
  // Получаем элементы после загрузки DOM
  searchInput = document.getElementById('searchInput');
  movieGrid = document.querySelector('#home .movie-grid');
  
  // Проверяем, не существует ли уже topMoviesGrid
  const existingTopMovies = document.querySelector('#home .top-movies');
  if (existingTopMovies) {
    topMoviesGrid = existingTopMovies;
  } else {
    topMoviesGrid = document.createElement('div');
    topMoviesGrid.className = 'top-movies';
  }

  // === Переключение экранов ===
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      const targetScreen = document.getElementById(screen) || document.getElementById('home');
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      targetScreen.classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Загружаем watchlist при переходе на экран
      if (screen === 'watchlist') {
        loadWatchlist();
      }
    });
  });

  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('home').classList.add('active');
      const homeBtn = document.querySelector('.nav-btn[data-screen="home"]');
      if (homeBtn) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        homeBtn.classList.add('active');
      }
    });
  });

  // === Поиск ===
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchMovies();
    });
    searchInput.addEventListener('input', () => console.log('[movies-app] main search input:', searchInput.value));
  }

  // Иконка поиска на главном экране (кликабельна)
  const homeSearchIcon = document.querySelector('#home .search-bar .fa-search');
  if (homeSearchIcon && searchInput) {
    homeSearchIcon.addEventListener('click', () => searchMovies());
  }

  // Поиск на экране search
  const searchInput2 = document.getElementById('searchInput2');
  const searchResults = document.getElementById('search-results');
  if (searchInput2 && searchResults) {
    searchInput2.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchMoviesFromScreen(searchInput2.value.trim(), searchResults);
      }
    });
    searchInput2.addEventListener('input', () => console.log('[movies-app] search screen input:', searchInput2.value));
    // Иконка поиска на экране Search
    const searchIcon2 = document.querySelector('#search .search-bar .fa-search');
    if (searchIcon2) {
      searchIcon2.addEventListener('click', () => searchMoviesFromScreen(searchInput2.value.trim(), searchResults));
    }
  }

  // Обработчик для кнопки bookmark в деталях
  const bookmarkBtn = document.querySelector('.bookmark-btn');
  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', toggleBookmark);
  }

 // === ОБРАБОТЧИКИ КНОПОК КАТЕГОРИЙ ===
document.querySelectorAll('.category-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const dropdown = document.getElementById('genresDropdown');

    // Если нажали на кнопку "Жанры"
    if (btn.classList.contains('genres-btn')) {
      e.stopPropagation();
      const isShowing = dropdown.classList.contains('show');

      // Закрываем меню, если оно открыто
      document.querySelectorAll('.genres-dropdown').forEach(d => d.classList.remove('show'));

      if (!isShowing) {
        dropdown.classList.add('show');
        btn.classList.add('active');
      } else {
        dropdown.classList.remove('show');
        btn.classList.remove('active');
      }
      return;
    }

    // При клике на другие категории закрываем выпадающее меню жанров
    dropdown.classList.remove('show');
    document.getElementById('genresBtn').classList.remove('active');

    // Сбрасываем активные кнопки и выделяем текущую
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Загружаем соответствующие фильмы, используем data-type для надёжности
    const type = btn.dataset.type;
    if (type === 'popular') {
      loadPopularMovies();
    } else if (type === 'top') {
      loadTopRatedMovies();
    } else if (type === 'new') {
      loadNewReleases();
    }
  });
});


// === ОБРАБОТЧИКИ ДЛЯ ВЫБОРА ЖАНРА ===
document.querySelectorAll('.genre-item').forEach(item => {
  item.addEventListener('click', () => {
    const genre = item.dataset.genre;

    // Подсветка активного жанра
    document.querySelectorAll('.genre-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    // Закрытие меню
    const dropdown = document.getElementById('genresDropdown');
    dropdown.classList.remove('show');

    // Активируем кнопку жанров
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('genresBtn').classList.add('active');

    // Загрузка фильмов по жанру
    loadMoviesByGenre(genre);
  });
});


// === ЗАКРЫТИЕ МЕНЮ ПРИ КЛИКЕ ВНЕ ===
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('genresDropdown');
  const genresBtn = document.getElementById('genresBtn');

  if (!dropdown.contains(e.target) && !genresBtn.contains(e.target)) {
    dropdown.classList.remove('show');
    genresBtn.classList.remove('active');
  }
});


  // Загружаем топ фильмы только один раз
  if (!existingTopMovies) {
    loadTop2025();
    loadPopularMovies(); // Загружаем популярные по умолчанию
  }
});

// === Watch List функции ===
function saveWatchlist() {
  localStorage.setItem('watchlist', JSON.stringify(watchlist));
}

function addToWatchlist(movie) {
  if (!movie || !movie.imdbID) {
    console.warn('[movies-app] addToWatchlist: invalid movie', movie);
    return false;
  }

  const exists = watchlist.find(m => m.imdbID === movie.imdbID);
  if (exists) return false;

  const item = {
    imdbID: movie.imdbID,
    Title: movie.Title || '',
    Year: movie.Year || '',
    Poster: movie.Poster || '',
    imdbRating: movie.imdbRating || 'N/A'
  };

  watchlist.push(item);
  saveWatchlist();
  updateBookmarkButton(movie.imdbID);
  console.log('[movies-app] added to watchlist:', movie.imdbID, movie.Title);

  // Если открыт экран watchlist — обновляем список сразу
  const active = document.querySelector('.screen.active');
  if (active && active.id === 'watchlist') loadWatchlist();

  return true;
}

function removeFromWatchlist(imdbID) {
  watchlist = watchlist.filter(m => m.imdbID !== imdbID);
  saveWatchlist();
  updateBookmarkButton(imdbID);
  console.log('[movies-app] removed from watchlist:', imdbID);

  const active = document.querySelector('.screen.active');
  if (active && active.id === 'watchlist') loadWatchlist();
}

function isInWatchlist(imdbID) {
  return watchlist.some(m => m.imdbID === imdbID);
}

function toggleBookmark() {
  console.log('[movies-app] toggleBookmark called');
  const posterImg = document.getElementById('detail-poster-img');
  if (!posterImg) {
    console.log('[movies-app] toggleBookmark: no posterImg');
    return;
  }

  const imdbID = posterImg.dataset.imdbId || '';
  if (!imdbID) {
    console.log('[movies-app] toggleBookmark: no imdbID on poster');
    return;
  }

  if (isInWatchlist(imdbID)) {
    console.log('[movies-app] toggleBookmark: removing', imdbID);
    removeFromWatchlist(imdbID);
  } else {
    const movieData = {
      imdbID,
      Title: document.getElementById('detail-title')?.textContent || '',
      Year: document.getElementById('detail-year')?.textContent.replace('📅 ', '') || '',
      Poster: posterImg.src || '',
      imdbRating: document.getElementById('detail-description')?.textContent.match(/⭐ ([\d.]+)/)?.[1] || 'N/A'
    };
    console.log('[movies-app] toggleBookmark: adding', imdbID, movieData.Title);
    addToWatchlist(movieData);
  }
}

function updateBookmarkButton(imdbID) {
  const bookmarkBtn = document.querySelector('.bookmark-btn');
  if (!bookmarkBtn) return;
  
  if (isInWatchlist(imdbID)) {
    bookmarkBtn.innerHTML = '<i class="fas fa-bookmark"></i>';
    bookmarkBtn.classList.add('active');
  } else {
    bookmarkBtn.innerHTML = '<i class="far fa-bookmark"></i>';
    bookmarkBtn.classList.remove('active');
  }
}

function loadWatchlist() {
  const watchlistGrid = document.querySelector('#watchlist .watchlist-grid');
  if (!watchlistGrid) return;
  console.log('[movies-app] loadWatchlist; items:', watchlist.length);
  
  watchlistGrid.innerHTML = '';
  
  if (watchlist.length === 0) {
    watchlistGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: rgba(255,255,255,0.6);">Ваш список пуст. Добавьте фильмы из деталей!</p>';
    return;
  }
  
  watchlist.forEach(movie => {
    createWatchlistCard(movie, watchlistGrid);
  });
}

function createWatchlistCard(movie, container) {
  const card = document.createElement('div');
  card.className = 'watchlist-card';
  
  // Улучшаем качество постера
  let posterUrl = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster';
  // Пытаемся получить более качественное изображение
  if (posterUrl.includes('images-na.ssl-images-amazon.com')) {
    posterUrl = posterUrl.replace('._V1_SX300', '._V1_SX600');
  }
  
  const title = movie.Title || 'Без названия';
  const rating = movie.imdbRating && movie.imdbRating !== 'N/A' ? movie.imdbRating : '?';
  
  card.innerHTML = `
    <img src="${posterUrl}" alt="${title}" loading="lazy">
    <div class="rating-badge">${rating}</div>
    <p>${title.length > 20 ? title.slice(0, 20) + '...' : title}</p>
    <button class="remove-btn" data-id="${movie.imdbID}">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  // Обработчик клика на карточку
  card.querySelector('img').addEventListener('click', () => {
    getMovieDetails(movie.imdbID, (details) => {
      showMovieDetail(details);
    });
  });
  
  // Обработчик удаления
  const removeBtn = card.querySelector('.remove-btn');
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeFromWatchlist(movie.imdbID);
    card.remove();
    if (watchlist.length === 0) {
      loadWatchlist();
    }
  });
  
  container.appendChild(card);
}

async function searchMovies() {
  if (!searchInput || !movieGrid) return;
  
  const query = searchInput.value.trim();
  if (!query) return;

  movieGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Загрузка...</p>';

  try {
    const res = await fetch(`${OMDB_BASE}?apikey=${OMDB_KEY}&s=${encodeURIComponent(query)}&type=movie`);
    
    if (!res.ok) {
      if (res.status === 401) {
        movieGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Ошибка API ключа. Получите бесплатный ключ на <a href="http://www.omdbapi.com/apikey.aspx" target="_blank" style="color: #e50914;">omdbapi.com</a></p>';
        return;
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();

    if (data.Response === 'False') {
      if (data.Error && data.Error.includes('API key')) {
        movieGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red; padding: 20px;">⚠️ API ключ недействителен или не активирован!<br><br>Проверьте email и подтвердите регистрацию на <a href="http://www.omdbapi.com/apikey.aspx" target="_blank" style="color: #e50914;">omdbapi.com</a><br>После подтверждения ключ начнет работать.</p>';
        return;
      }
      movieGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: red;">Ошибка: ${data.Error || 'Неизвестная ошибка'}</p>`;
      return;
    }

    movieGrid.innerHTML = '';
    if (data.Response === 'True' && data.Search) {
      // Ограничиваем количество запросов для производительности
      const moviesToLoad = data.Search.slice(0, 9);
      const promises = moviesToLoad.map(movie => 
        new Promise(resolve => {
          getMovieDetails(movie.imdbID, (details) => {
            createMovieCard(details, movieGrid);
            resolve();
          });
        })
      );
      await Promise.all(promises);
    } else {
      movieGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Ничего не найдено</p>';
    }
  } catch (err) {
    movieGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Ошибка сети</p>';
    console.error(err);
  }
}

// Поиск с экрана search
async function searchMoviesFromScreen(query, container) {
  if (!query || !container) return;

  container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Загрузка...</p>';

  try {
    const res = await fetch(`${OMDB_BASE}?apikey=${OMDB_KEY}&s=${encodeURIComponent(query)}&type=movie`);
    
    if (!res.ok) {
      if (res.status === 401) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Ошибка API ключа. Получите бесплатный ключ на <a href="http://www.omdbapi.com/apikey.aspx" target="_blank" style="color: #e50914;">omdbapi.com</a></p>';
        return;
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();

    if (data.Response === 'False') {
      if (data.Error && data.Error.includes('API key')) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red; padding: 20px;">⚠️ API ключ недействителен или не активирован!<br><br>Проверьте email и подтвердите регистрацию на <a href="http://www.omdbapi.com/apikey.aspx" target="_blank" style="color: #e50914;">omdbapi.com</a><br>После подтверждения ключ начнет работать.</p>';
        return;
      }
      container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: red;">Ошибка: ${data.Error || 'Неизвестная ошибка'}</p>`;
      return;
    }

    container.innerHTML = '';
    if (data.Response === 'True' && data.Search) {
      const moviesToLoad = data.Search.slice(0, 9);
      const promises = moviesToLoad.map(movie => 
        new Promise(resolve => {
          getMovieDetails(movie.imdbID, (details) => {
            createMovieCard(details, container);
            resolve();
          });
        })
      );
      await Promise.all(promises);
    } else {
      container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Ничего не найдено</p>';
    }
  } catch (err) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Ошибка сети</p>';
    console.error(err);
  }
}

// === Функция для деталей по ID ===
async function getMovieDetails(id, callback) {
  try {
    const res = await fetch(`${OMDB_BASE}?apikey=${OMDB_KEY}&i=${id}&plot=full&type=movie`);
    
    if (!res.ok) {
      if (res.status === 401) {
        console.error('API ключ недействителен. Получите бесплатный ключ на http://www.omdbapi.com/apikey.aspx');
        return;
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.Response === 'False') {
      if (data.Error && data.Error.includes('API key')) {
        console.error('⚠️ API ключ недействителен или не активирован! Проверьте email и подтвердите регистрацию.');
        return;
      }
      console.error('Ошибка API:', data.Error);
      return;
    }
    
    if (data.Response === 'True') {
      callback(data);
    }
  } catch (err) {
    console.error(err);
  }
}

// === Топ фильмы 2025 ===
async function loadTop2025() {
  const container = document.querySelector('#home');
  if (!container) return;
  
  // Проверяем, не добавлен ли уже заголовок
  let heading = container.querySelector('.top-movies-heading');
  if (!heading) {
    heading = document.createElement('h3');
    heading.className = 'top-movies-heading';
    heading.textContent = '⭐ Топ фильмы';
    container.appendChild(heading);
  }
  
  // Очищаем только если это новый контейнер
  if (topMoviesGrid.children.length === 0) {
    topMoviesGrid.innerHTML = '<p style="text-align: center;">Загрузка...</p>';
  }
  
  // Добавляем только если еще не добавлен
  if (!container.contains(topMoviesGrid)) {
    container.appendChild(topMoviesGrid);
  }

  try {
    // Используем популярные фильмы вместо 2025
    const res = await fetch(`${OMDB_BASE}?apikey=${OMDB_KEY}&s=movie&type=movie&y=2023`);
    
    if (!res.ok) {
      if (res.status === 401) {
        topMoviesGrid.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">Ошибка API ключа (401). Получите бесплатный ключ на <a href="http://www.omdbapi.com/apikey.aspx" target="_blank" style="color: #e50914;">omdbapi.com</a> и замените OMDB_KEY в scripts.js</p>';
        return;
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();

    if (data.Response === 'False') {
      if (data.Error && data.Error.includes('API key')) {
        topMoviesGrid.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">⚠️ API ключ недействителен или не активирован!<br><br>Проверьте email и подтвердите регистрацию на <a href="http://www.omdbapi.com/apikey.aspx" target="_blank" style="color: #e50914;">omdbapi.com</a><br>После подтверждения ключ начнет работать.</p>';
        return;
      }
      topMoviesGrid.innerHTML = `<p style="text-align: center; color: red; padding: 20px;">Ошибка: ${data.Error || 'Неизвестная ошибка'}</p>`;
      return;
    }

    topMoviesGrid.innerHTML = '<div class="movie-grid"></div>';
    const grid = topMoviesGrid.querySelector('.movie-grid');

    if (data.Response === 'True' && data.Search) {
      // Загружаем больше фильмов - делаем несколько запросов для разнообразия
      const allMovies = [];
      
      // Первый запрос
      data.Search.forEach(movie => allMovies.push(movie));
      
      // Дополнительные запросы для большего количества фильмов
      const additionalQueries = ['action', 'comedy', 'drama', 'thriller', 'horror', 'sci-fi'];
      for (const query of additionalQueries.slice(0, 3)) {
        try {
          const additionalRes = await fetch(`${OMDB_BASE}?apikey=${OMDB_KEY}&s=${query}&type=movie&y=2023`);
          if (additionalRes.ok) {
            const additionalData = await additionalRes.json();
            if (additionalData.Response === 'True' && additionalData.Search) {
              additionalData.Search.forEach(movie => {
                // Проверяем на дубликаты
                if (!allMovies.find(m => m.imdbID === movie.imdbID)) {
                  allMovies.push(movie);
                }
              });
            }
          }
        } catch (err) {
          console.error('Ошибка загрузки дополнительных фильмов:', err);
        }
      }
      
      // Загружаем до 24 фильмов
      const moviesToLoad = allMovies.slice(0, 24);
      const promises = moviesToLoad.map(movie => 
        new Promise(resolve => {
          getMovieDetails(movie.imdbID, (details) => {
            createMovieCard(details, grid);
            resolve();
          });
        })
      );
      await Promise.all(promises);
    } else {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #aaa;">Фильмы не найдены</p>';
    }
  } catch (err) {
    topMoviesGrid.innerHTML = '<p style="color: red;">Ошибка загрузки</p>';
    console.error(err);
  }
}

// === Создание карточки фильма ===
function createMovieCard(movie, container) {
  // Проверяем, не существует ли уже такая карточка
  const existingCard = container.querySelector(`[data-imdb-id="${movie.imdbID}"]`);
  if (existingCard) return;
  
  const card = document.createElement('div');
  card.className = 'movie-card';
  card.dataset.imdbId = movie.imdbID;

  // Улучшаем качество постера
  let posterUrl = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster';
  // Пытаемся получить более качественное изображение от OMDb
  if (posterUrl.includes('images-na.ssl-images-amazon.com') || posterUrl.includes('m.media-amazon.com')) {
    posterUrl = posterUrl.replace('._V1_SX300', '._V1_SX600').replace('._V1_UX300', '._V1_UX600');
  }
  
  const title = movie.Title || 'Без названия';
  const rating = movie.imdbRating && movie.imdbRating !== 'N/A' ? movie.imdbRating : '?';

  card.innerHTML = `
    <img src="${posterUrl}" alt="${title}" loading="lazy">
    <div class="rating-badge">${rating}</div>
    <p>${title.length > 15 ? title.slice(0, 15) + '...' : title}</p>
  `;

  // Обработчик клика на карточку
  card.addEventListener('click', (e) => {
    e.stopPropagation();
    showMovieDetail(movie);
  });
  
  container.appendChild(card);
}

// === Функции для категорий ===
async function loadPopularMovies() {
  const grid = document.querySelector('#home .movie-grid');
  if (!grid) return;
  
  grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Загрузка популярных фильмов...</p>';
  
  try {
    // Популярные запросы для получения разнообразных фильмов
    const popularQueries = ['movie', 'action', 'comedy', 'drama', 'thriller', 'adventure'];
    const allMovies = [];
    
    for (const query of popularQueries) {
      try {
        const res = await fetch(`${OMDB_BASE}?apikey=${OMDB_KEY}&s=${query}&type=movie&y=2023`);
        if (res.ok) {
          const data = await res.json();
          if (data.Response === 'True' && data.Search) {
            data.Search.forEach(movie => {
              if (!allMovies.find(m => m.imdbID === movie.imdbID)) {
                allMovies.push(movie);
              }
            });
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки:', err);
      }
    }
    
    grid.innerHTML = '';
    if (allMovies.length > 0) {
      const moviesToLoad = allMovies.slice(0, 18);
      const promises = moviesToLoad.map(movie => 
        new Promise(resolve => {
          getMovieDetails(movie.imdbID, (details) => {
            createMovieCard(details, grid);
            resolve();
          });
        })
      );
      await Promise.all(promises);
    } else {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Фильмы не найдены</p>';
    }
  } catch (err) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Ошибка загрузки</p>';
    console.error(err);
  }
}

async function loadTopRatedMovies() {
  const grid = document.querySelector('#home .movie-grid');
  if (!grid) return;
  
  grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Загрузка топовых фильмов...</p>';
  
  try {
    // Используем популярные фильмы с высоким рейтингом
    const topQueries = ['inception', 'interstellar', 'matrix', 'pulp fiction', 'godfather', 'shawshank'];
    const allMovies = [];
    
    for (const query of topQueries) {
      try {
        const res = await fetch(`${OMDB_BASE}?apikey=${OMDB_KEY}&s=${query}&type=movie`);
        if (res.ok) {
          const data = await res.json();
          if (data.Response === 'True' && data.Search) {
            data.Search.forEach(movie => {
              if (!allMovies.find(m => m.imdbID === movie.imdbID)) {
                allMovies.push(movie);
              }
            });
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки:', err);
      }
    }
    
    grid.innerHTML = '';
    if (allMovies.length > 0) {
      // Загружаем детали и сортируем по рейтингу
      const moviesWithDetails = await Promise.all(
        allMovies.slice(0, 20).map(movie => 
          new Promise(resolve => {
            getMovieDetails(movie.imdbID, (details) => {
              resolve(details);
            });
          })
        )
      );
      
      // Сортируем по рейтингу
      moviesWithDetails.sort((a, b) => {
        const ratingA = parseFloat(a.imdbRating) || 0;
        const ratingB = parseFloat(b.imdbRating) || 0;
        return ratingB - ratingA;
      });
      
      moviesWithDetails.slice(0, 18).forEach(movie => {
        createMovieCard(movie, grid);
      });
    } else {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Фильмы не найдены</p>';
    }
  } catch (err) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Ошибка загрузки</p>';
    console.error(err);
  }
}

async function loadNewReleases() {
  const grid = document.querySelector('#home .movie-grid');
  if (!grid) return;
  
  grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Загрузка новых релизов...</p>';
  
  try {
    // Новые фильмы последних лет
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];
    const allMovies = [];
    
    for (const year of years) {
      try {
        const res = await fetch(`${OMDB_BASE}?apikey=${OMDB_KEY}&s=movie&type=movie&y=${year}`);
        if (res.ok) {
          const data = await res.json();
          if (data.Response === 'True' && data.Search) {
            data.Search.forEach(movie => {
              if (!allMovies.find(m => m.imdbID === movie.imdbID)) {
                allMovies.push(movie);
              }
            });
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки:', err);
      }
    }
    
    grid.innerHTML = '';
    if (allMovies.length > 0) {
      const moviesToLoad = allMovies.slice(0, 18);
      const promises = moviesToLoad.map(movie => 
        new Promise(resolve => {
          getMovieDetails(movie.imdbID, (details) => {
            createMovieCard(details, grid);
            resolve();
          });
        })
      );
      await Promise.all(promises);
    } else {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Фильмы не найдены</p>';
    }
  } catch (err) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Ошибка загрузки</p>';
    console.error(err);
  }
}

async function loadGenresMovies() {
  const grid = document.querySelector('#home .movie-grid');
  if (!grid) return;
  
  grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Выберите жанр из меню выше</p>';
}

// Загрузка фильмов по конкретному жанру
async function loadMoviesByGenre(genre) {
  const grid = document.querySelector('#home .movie-grid');
  if (!grid) return;
  
  const genreNames = {
    'action': 'боевик',
    'comedy': 'комедия',
    'drama': 'драма',
    'thriller': 'триллер',
    'horror': 'ужасы',
    'sci-fi': 'фантастика',
    'romance': 'романтика',
    'adventure': 'приключения',
    'fantasy': 'фэнтези',
    'animation': 'мультфильм'
  };
  
  grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">Загрузка фильмов жанра "${genreNames[genre] || genre}"...</p>`;
  
  try {
    const allMovies = [];
    
    // Делаем несколько запросов для получения большего количества фильмов
    const queries = [genre, genre + ' movie', genre + ' film'];
    
    for (const query of queries) {
      try {
        const res = await fetch(`${OMDB_BASE}?apikey=${OMDB_KEY}&s=${encodeURIComponent(query)}&type=movie`);
        if (res.ok) {
          const data = await res.json();
          if (data.Response === 'True' && data.Search) {
            data.Search.forEach(movie => {
              if (!allMovies.find(m => m.imdbID === movie.imdbID)) {
                allMovies.push(movie);
              }
            });
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки:', err);
      }
    }
    
    grid.innerHTML = '';
    if (allMovies.length > 0) {
      const moviesToLoad = allMovies.slice(0, 18);
      const promises = moviesToLoad.map(movie => 
        new Promise(resolve => {
          getMovieDetails(movie.imdbID, (details) => {
            createMovieCard(details, grid);
            resolve();
          });
        })
      );
      await Promise.all(promises);
    } else {
      grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">Фильмы жанра "${genreNames[genre] || genre}" не найдены</p>`;
    }
  } catch (err) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Ошибка загрузки</p>';
    console.error(err);
  }
}

// === Детали фильма ===
function showMovieDetail(movie) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('detail').classList.add('active');
  
  // Обновляем навигацию
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('detail-title').textContent = movie.Title || 'Без названия';
  
  const year = movie.Year || '—';
  const duration = movie.Runtime || '—';
  const genre = movie.Genre ? movie.Genre.split(',').slice(0, 2).join(', ') : '—';
  
  document.getElementById('detail-year').textContent = `📅 ${year}`;
  document.getElementById('detail-duration').textContent = `⏱️ ${duration}`;
  document.getElementById('detail-genre').textContent = `🎭 ${genre}`;
  
  // Улучшаем качество постера для деталей
  let posterUrl = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster';
  if (posterUrl.includes('images-na.ssl-images-amazon.com') || posterUrl.includes('m.media-amazon.com')) {
    // Используем максимальное качество для деталей
    posterUrl = posterUrl.replace('._V1_SX300', '._V1_SX1000').replace('._V1_UX300', '._V1_UX1000').replace('._V1_SX600', '._V1_SX1000');
  }
  
  const posterImg = document.getElementById('detail-poster-img');
  posterImg.src = posterUrl;
  posterImg.alt = movie.Title || 'Movie poster';
  posterImg.dataset.imdbId = movie.imdbID;
  
  const plot = movie.Plot && movie.Plot !== 'N/A' ? movie.Plot : 'Описание отсутствует.';
  const rating = movie.imdbRating && movie.imdbRating !== 'N/A' ? movie.imdbRating : null;
  
  if (rating) {
    document.getElementById('detail-description').textContent = `⭐ ${rating}/10\n\n${plot}`;
  } else {
    document.getElementById('detail-description').textContent = plot;
  }
  
  // Обновляем кнопку bookmark
  updateBookmarkButton(movie.imdbID);
}
