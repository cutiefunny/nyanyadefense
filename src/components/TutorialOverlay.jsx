import { createSignal, createEffect, Show, For, onMount, onCleanup } from 'solid-js';
import tutorialCat from '../assets/tutorial_cat.png';
import './TutorialOverlay.css';

const HIGHLIGHT_MAP = {
  'squad_button': { x: 480, y: 160, w: 270, h: 43 },
  'upgrade_button': { x: 480, y: 100, w: 270, h: 43 },
  'battle_button': { x: 480, y: 40, w: 270, h: 43 },
  'gacha_button': { x: 480, y: 220, w: 270, h: 43 }
};

export default function TutorialOverlay(props) {
  const [currentStep, setCurrentStep] = createSignal(0);
  const [highlightStyle, setHighlightStyle] = createSignal(null);
  const [bubbleStyle, setBubbleStyle] = createSignal({});

  const steps = () => props.tutorial?.steps || [];
  const step = () => steps()[currentStep()];

  createEffect(() => {
    const t = props.tutorial;
    if (t?.autoCycle) {
      const interval = setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % steps().length);
      }, t.autoCycle);
      onCleanup(() => clearInterval(interval));
    }
  });

  createEffect(() => {
    const hKey = step()?.highlight;
    if (hKey && HIGHLIGHT_MAP[hKey]) {
      const h = HIGHLIGHT_MAP[hKey];
      setHighlightStyle({
        top: `${(h.y / 300) * 100}%`,
        left: `${(h.x / 800) * 100}%`,
        width: `${(h.w / 800) * 100}%`,
        height: `${(h.h / 300) * 100}%`
      });
    } else {
      setHighlightStyle(null);
    }

    setBubbleStyle({
      top: '10px',
      left: '10px'
    });

    if (step()?.position === 'top-right') {
      const canvas = document.querySelector('.phaser-container canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        setBubbleStyle({
          top: '10px',
          right: `${window.innerWidth - rect.right + 10}px`,
          left: 'auto'
        });
      }
    }
  });

  // No need for resize listeners anymore as CSS percentages handle it

  const handleGlobalClick = (e) => {
    if (!props.tutorial) return;
    const hKey = step()?.highlight;
    if (!hKey || !HIGHLIGHT_MAP[hKey]) return;

    const canvas = document.querySelector('.phaser-container canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const h = HIGHLIGHT_MAP[hKey];

    // Convert 800x300 coords to screen pixels
    const scaleX = rect.width / 800;
    const scaleY = rect.height / 300;

    const screenX = rect.left + h.x * scaleX;
    const screenY = rect.top + h.y * scaleY;
    const screenW = h.w * scaleX;
    const screenH = h.h * scaleY;

    if (
      e.clientX >= screenX &&
      e.clientX <= screenX + screenW &&
      e.clientY >= screenY &&
      e.clientY <= screenY + screenH
    ) {
      // Click was inside the highlight!
      handleNext();
    }
  };

  onMount(() => {
    window.addEventListener('mousedown', handleGlobalClick, true); // Use capture phase
  });

  onCleanup(() => {
    window.removeEventListener('mousedown', handleGlobalClick, true);
  });

  const handleNext = () => {
    if (currentStep() < steps().length - 1) {
      setCurrentStep(currentStep() + 1);
    } else {
      props.onComplete(props.tutorial.id, false);
      setCurrentStep(0);
    }
  };

  const handleSkip = () => {
    props.onComplete(props.tutorial.id, false);
    setCurrentStep(0);
  };

  return (
    <Show when={props.tutorial}>
      <div class="tutorial-overlay">
        <Show when={highlightStyle()}>
          <div class="tutorial-highlight" style={highlightStyle()}></div>
        </Show>
        <Show when={!props.tutorial?.autoCycle}>
          <div class="tutorial-mask"></div>
        </Show>
        
        <div class="tutorial-bubble mini" 
          class:auto-info={props.tutorial?.autoCycle}
          style={bubbleStyle()}
        >
          <Show when={!props.tutorial?.autoCycle}>
            <div class="tutorial-header">
              <div class="cat-avatar">
                <img src={tutorialCat} alt="Cat Guide" />
              </div>
              <div class="header-controls">
                <span class="step-indicator">{currentStep() + 1} / {steps().length}</span>
                <button class="tutorial-skip-btn" onClick={handleSkip}>SKIP</button>
                <button class="tutorial-next-btn" onClick={handleNext}>
                  {currentStep() === steps().length - 1 ? '알겠다냥!' : '다음'}
                </button>
              </div>
            </div>
          </Show>

          <Show when={props.tutorial?.autoCycle}>
            <button class="tutorial-close-mini" onClick={handleSkip}>×</button>
          </Show>

          <div class="tutorial-body">
            <div class="tutorial-text">
              {step()?.text}
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
