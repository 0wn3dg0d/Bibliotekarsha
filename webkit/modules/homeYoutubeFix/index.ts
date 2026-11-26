import { StoreWebkitConfig, injectStyleOnce } from '../../shared/ipc';

const IMG_PROXY = 'https://external-content.duckduckgo.com/iu/?u=https://img.youtube.com/vi/';

const YT_FIX_CSS = `
  .use-yt-spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top: 4px solid #67c1f5;
    border-radius: 50%;
    animation: bshYtSpin 1s linear infinite;
    z-index: 5;
  }
  @keyframes bshYtSpin {
    0% { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(360deg); }
  }
  .use-yt-play {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 50px;
    height: 50px;
    background: rgba(0, 0, 0, 0.72);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: none;
    transition: background 0.2s, transform 0.2s;
    z-index: 2;
  }
  .use-yt-play svg { width: 24px; height: 24px; fill: #fff; margin-left: 4px; }
  .blotter_video_player_sizing_ctn:hover .use-yt-play {
    background: rgba(255, 0, 0, 0.9);
    transform: translate(-50%, -50%) scale(1.1);
  }
`;

export function initCommunityHomeYoutubeFixModule(cfg: StoreWebkitConfig): void {
  if (!cfg.homeYoutubeFix) return;
  if (!window.location.hostname.includes('steamcommunity.com')) return;
  if (!window.location.pathname.includes('/home')) return;

  injectStyleOnce('bsh-home-ytfix-css', YT_FIX_CSS);

  const fixYoutubeEmbeds = () => {
    const videoBlocks = document.querySelectorAll(
      '.blotter_video_player_sizing_ctn:not(.yt-fixed):not(.yt-processing)'
    );

    videoBlocks.forEach((rawBlock) => {
      const block = rawBlock as HTMLElement;
      block.classList.add('yt-processing');
      block.style.position = 'relative';

      const iframe = block.querySelector('iframe.movieFrame') as HTMLIFrameElement | null;
      const placeholderImg = block.querySelector(
        'img[src*="youtube_16x9_placeholder.gif"]'
      ) as HTMLImageElement | null;

      const match = iframe?.src?.match(/embed\/([a-zA-Z0-9_-]{11})/);
      if (!iframe || !match?.[1]) {
        block.classList.remove('yt-processing');
        block.classList.add('yt-fixed');
        return;
      }

      const videoId = match[1];
      const proxyThumbUrl = `${IMG_PROXY}${videoId}/hqdefault.jpg`;
      const directThumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      const spinner = document.createElement('div');
      spinner.className = 'use-yt-spinner';
      block.appendChild(spinner);
      iframe.style.opacity = '0';

      setTimeout(() => {
        spinner.remove();
        block.classList.remove('yt-processing');
        block.classList.add('yt-fixed');
        iframe.style.display = 'none';

        if (placeholderImg) {
          placeholderImg.style.cursor = 'pointer';
          placeholderImg.title = 'Смотреть видео на YouTube';
          placeholderImg.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
          });

          placeholderImg.onerror = () => {
            if (!placeholderImg.dataset.ytFallbackTried) {
              placeholderImg.dataset.ytFallbackTried = '1';
              placeholderImg.src = directThumbUrl;
            }
          };
          placeholderImg.src = proxyThumbUrl;
          placeholderImg.style.display = 'block';

          if (!block.querySelector('.use-yt-play')) {
            const playIcon = document.createElement('div');
            playIcon.className = 'use-yt-play';
            playIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            block.appendChild(playIcon);
          }
        }
      }, 1600);
    });
  };

  setTimeout(() => {
    fixYoutubeEmbeds();
    const obs = new MutationObserver(() => fixYoutubeEmbeds());
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  }, 1500);
}
