import './styles.css';
import { renderApp, registerServiceWorker } from './app.js';

renderApp(document.querySelector('#app'), { status: 'Escala pronta para consulta.' });
registerServiceWorker().catch(() => {});
