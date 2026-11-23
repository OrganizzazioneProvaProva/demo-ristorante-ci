/**
 * Galleria a ventaglio: posizione di ogni foto rispetto a quella attiva, trascinamento, frecce,
 * pulsanti e tastiera. Il contenuto resta nell'HTML: senza JavaScript la regione è una fila che
 * scorre (vedi `gallery-fan.css`).
 *
 * Ciclo infinito "a buffer": la foto che esce da un lato rientra dall'altro. Quelle appena fuori
 * dal ventaglio (a distanza `raggio + 1`) sono già posizionate ma trasparenti: entrano
 * dissolvendosi. Prima di ogni mossa le foto trasparenti dal lato da cui si esce passano
 * dall'altra parte senza animazione (`data-jump`), così non attraversano mai il ventaglio. Il
 * ciclo vuole almeno `2 × raggio + 2` foto (6): con meno, `Gallery.astro` non usa il ventaglio.
 */
const THRESHOLD = 30;
const SLOP = 6;

for (const root of document.querySelectorAll<HTMLElement>("[data-fan]")) {
	const q = <T extends HTMLElement>(selector: string) =>
		root.querySelector<T>(selector);
	const viewport = q("[data-fan-viewport]");
	const slides = [...root.querySelectorAll<HTMLElement>("[data-fan-slide]")];
	const prev = q("[data-fan-prev]");
	const next = q("[data-fan-next]");
	const controls = q("[data-fan-controls]");
	const status = q("[data-fan-status]");
	const count = slides.length;
	if (!viewport || count === 0) continue;

	let active = Math.floor((count - 1) / 2);
	let radius = 1;
	let step = 100;
	let from: number | undefined;
	let dx = 0;
	let moved = false;
	// Posizione di ogni foto rispetto al centro (0 = al centro, negativo = a sinistra).
	const pos = slides.map((_, index) => index - active);

	const render = (): void => {
		const shift = from === undefined ? 0 : dx / step;
		slides.forEach((slide, index) => {
			const offset = (pos[index] ?? 0) + shift;
			const abs = Math.abs(offset);
			slide.style.setProperty("--offset", offset.toFixed(3));
			slide.style.setProperty("--abs", abs.toFixed(3));
			// Piena fino al raggio, poi sfuma fino a sparire a `raggio + 1`.
			slide.style.setProperty(
				"--vis",
				Math.max(0, Math.min(1, radius + 1 - abs)).toFixed(3),
			);
			slide.toggleAttribute("data-hidden", abs > radius + 1);
			if (index === active) slide.setAttribute("aria-current", "true");
			else slide.removeAttribute("aria-current");
		});
	};

	/** Fa passare, senza animazione, le foto trasparenti dal lato da cui si sta per uscire. */
	const hop = (dir: number): void => {
		let any = false;
		slides.forEach((slide, index) => {
			const at = pos[index] ?? 0;
			if (dir > 0 && at <= -(radius + 1)) pos[index] = at + count;
			else if (dir < 0 && at >= radius + 1) pos[index] = at - count;
			else return;
			slide.setAttribute("data-jump", "");
			any = true;
		});
		if (!any) return;
		render();
		void viewport.offsetWidth;
		for (const slide of slides) slide.removeAttribute("data-jump");
	};

	/** Sposta il centro di `delta` foto (positivo = avanti). */
	const go = (delta: number): void => {
		if (delta !== 0) {
			hop(delta);
			active = (((active + delta) % count) + count) % count;
			for (let index = 0; index < count; index++)
				pos[index] = (pos[index] ?? 0) - delta;
			if (status?.dataset.template) {
				status.textContent = status.dataset.template
					.replace("{n}", String(active + 1))
					.replace("{total}", String(count));
			}
		}
		render();
	};

	prev?.addEventListener("click", () => go(-1));
	next?.addEventListener("click", () => go(1));
	root.addEventListener("keydown", (event) => {
		const delta =
			event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
		if (delta) {
			event.preventDefault();
			go(delta);
		}
	});

	let hopped = false;
	viewport.addEventListener("pointerdown", (event) => {
		if (event.pointerType === "mouse" && event.button !== 0) return;
		from = event.clientX;
		dx = 0;
		moved = false;
		hopped = false;
		viewport.setAttribute("data-dragging", "");
		viewport.setPointerCapture(event.pointerId);
	});
	viewport.addEventListener("pointermove", (event) => {
		if (from === undefined) return;
		dx = event.clientX - from;
		if (Math.abs(dx) > SLOP) {
			moved = true;
			// Appena si sa in che verso si trascina, la foto di scorta passa dal lato da cui entra.
			if (!hopped) hop(dx < 0 ? 1 : -1);
			hopped = true;
		}
		render();
	});
	const end = (event: PointerEvent): void => {
		if (from === undefined) return;
		const distance = dx;
		from = undefined;
		dx = 0;
		viewport.removeAttribute("data-dragging");
		if (!moved && event.type === "pointerup") {
			// Con il puntatore catturato il `click` va al contenitore: si cerca la foto sotto il puntatore.
			const hit = document
				.elementsFromPoint(event.clientX, event.clientY)
				.map((element) => element.closest<HTMLElement>("[data-fan-slide]"))
				.find((slide) => slide !== null);
			// La posizione della foto è proprio di quante foto serve spostare per portarla al centro.
			if (hit) {
				go(Math.round(pos[slides.indexOf(hit)] ?? 0));
				return;
			}
		}
		let shift = Math.round(-distance / step);
		if (shift === 0 && Math.abs(distance) > THRESHOLD)
			shift = distance < 0 ? 1 : -1;
		go(shift);
	};
	viewport.addEventListener("pointerup", end);
	viewport.addEventListener("pointercancel", end);

	const measure = (): void => {
		const style = getComputedStyle(root);
		radius = Number.parseFloat(style.getPropertyValue("--fan-radius")) || 1;
		step =
			Number.parseFloat(style.getPropertyValue("--fan-step")) *
				Number.parseFloat(
					getComputedStyle(document.documentElement).fontSize,
				) || 100;
		// Cambiando larghezza cambia il raggio: si ricalcolano le posizioni dal centro attuale.
		slides.forEach((_, index) => {
			const at = index - active;
			pos[index] = at - count * Math.round(at / count);
		});
	};
	window.matchMedia("(min-width: 48rem)").addEventListener("change", () => {
		measure();
		render();
	});
	measure();
	// Alla prima disposizione le foto non si animano dalla posizione "piatta" a quella a ventaglio.
	for (const slide of slides) slide.setAttribute("data-jump", "");
	root.setAttribute("data-fan-ready", "");
	if (controls) controls.hidden = false;
	render();
	void viewport.offsetWidth;
	for (const slide of slides) slide.removeAttribute("data-jump");
}

// Un modulo (non uno script globale): le variabili degli script non devono scontrarsi.
export {};
