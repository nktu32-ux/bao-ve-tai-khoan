const hero = document.querySelector(".hero");

if (location.protocol !== "file:") {
  import("./taste/motion.js").catch(() => {
    document.documentElement.classList.add("m-enter-done");
  });

  const effect = hero.querySelector("[data-fx]");
  import("./taste/effects/fx.js")
    .then(({ default: fx }) => fx.mount(effect, effect.dataset.fx))
    .then((controller) => {
      // Keep the background still after the entrance.
      setTimeout(() => controller?.pause(), 3500);
    })
    .catch(() => {
      // The banner has its own static background.
    });
}
