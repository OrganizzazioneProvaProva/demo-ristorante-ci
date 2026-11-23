/**
 * Ingrandimento delle foto della galleria a blocchi. La foto si espande dalla sua miniatura fino a
 * riempire buona parte dello schermo e, con un altro clic, torna nel suo posto: l'animazione la fa il
 * browser (View Transitions: la stessa foto, con lo stesso `view-transition-name`, prima nella
 * miniatura e poi nella finestra). Senza quel supporto, o con movimento ridotto, la foto compare e
 * sparisce subito. Senza JavaScript la miniatura è un link alla foto intera.
 */
for (const root of document.querySelectorAll<HTMLElement>(
	"[data-lightbox-root]",
)) {
	const dialog = root.querySelector<HTMLDialogElement>("dialog");
	const big = dialog?.querySelector<HTMLImageElement>("img");
	if (!dialog || !big) continue;
	let thumb: HTMLImageElement | undefined;

	/** Esegue il cambio con l'animazione del browser, se c'è e non è disattivata. */
	const animate = async (change: () => void): Promise<void> => {
		const still =
			matchMedia("(prefers-reduced-motion: reduce)").matches ||
			document.documentElement.dataset.motion === "no-animation";
		if (still || !document.startViewTransition) {
			change();
			return;
		}
		const root = document.documentElement;
		root.setAttribute("data-lightbox-vt", "");
		try {
			await document.startViewTransition(change).finished;
		} finally {
			root.removeAttribute("data-lightbox-vt");
		}
	};

	for (const link of root.querySelectorAll<HTMLElement>(
		"[data-lightbox-open]",
	)) {
		link.addEventListener("click", async (event) => {
			const image = link.querySelector("img");
			if (!image) return;
			event.preventDefault();
			// La foto grande sta sotto la barra in alto (e l'eventuale fascia degli avvisi): lo spazio
			// che questa occupa ora, in alto nella finestra, è il margine superiore della foto.
			const top =
				document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
			dialog.style.setProperty("--lb-top", `${Math.max(0, top)}px`);
			thumb = image;
			big.src = image.src;
			big.alt = image.alt;
			big.lang = image.lang;
			image.style.viewTransitionName = "lightbox";
			await animate(() => {
				image.style.viewTransitionName = "";
				big.style.viewTransitionName = "lightbox";
				dialog.showModal();
			});
		});
	}

	const close = async (): Promise<void> => {
		const image = thumb;
		if (!image || !dialog.open) return;
		await animate(() => {
			big.style.viewTransitionName = "";
			image.style.viewTransitionName = "lightbox";
			dialog.close();
		});
		image.style.viewTransitionName = "";
	};
	dialog.addEventListener("click", close);
	// Esc: stessa strada del clic, così anche la chiusura è animata.
	dialog.addEventListener("cancel", (event) => {
		event.preventDefault();
		close();
	});
}

// Un modulo (non uno script globale): le variabili degli script non devono scontrarsi.
export {};
