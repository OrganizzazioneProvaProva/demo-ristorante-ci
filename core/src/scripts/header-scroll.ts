import {
	type HeaderScrollState,
	nextHeaderScrollState,
} from "../header-scroll-state.ts";

/**
 * Nasconde l'intestazione del telefono scorrendo in basso e la mostra risalendo. Lo stato sta
 * nell'attributo `data-scroll` (hidden | visible): l'aspetto lo decide il CSS (`motion.css`,
 * solo sotto `md` e con il movimento consentito). Niente `inert` né `visibility`: la navigazione
 * resta nell'ordine di Tab. Con `prefers-reduced-motion: reduce` non fa nulla. Con il livello
 * `no-animation` (`<html data-motion>`) lo stato si scrive lo stesso ma il CSS non lo usa:
 * l'intestazione resta ferma.
 */
const header = document.querySelector<HTMLElement>("[data-site-header]");

if (header) {
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
	let state: HeaderScrollState = { hidden: false, anchor: window.scrollY };
	let scheduled = false;

	const update = () => {
		scheduled = false;
		// con il menu aperto lo stato non cambia
		if (document.querySelector("nav[popover]:popover-open")) return;
		const next = nextHeaderScrollState(state, window.scrollY, {
			maxY: document.documentElement.scrollHeight - window.innerHeight,
			headerHeight: header.offsetHeight,
		});
		if (next.hidden !== state.hidden) {
			header.dataset.scroll = next.hidden ? "hidden" : "visible";
		}
		state = next;
	};

	const onScroll = () => {
		if (scheduled) return;
		scheduled = true;
		requestAnimationFrame(update);
	};

	const apply = () => {
		if (reduced.matches) {
			window.removeEventListener("scroll", onScroll);
			delete header.dataset.scroll;
			state = { hidden: false, anchor: window.scrollY };
		} else {
			window.addEventListener("scroll", onScroll, { passive: true });
		}
	};

	apply();
	reduced.addEventListener("change", apply);

	// Aprendo il menu del telefono il focus entra nel pannello (sulla prima voce), così chi usa la tastiera
	// o uno screen reader si trova subito tra le voci; Esc richiude e riporta il focus al pulsante.
	const menu = header.querySelector<HTMLElement>("nav[popover]");
	menu?.addEventListener("toggle", (event) => {
		if ((event as ToggleEvent).newState === "open") {
			menu.querySelector<HTMLElement>("a")?.focus();
		}
	});
}
