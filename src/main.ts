import './style.css';
import { ShadowRequiemGame } from './game/ShadowRequiemGame';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Missing #app root element.');
}

const game = new ShadowRequiemGame(root);

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy());
}
