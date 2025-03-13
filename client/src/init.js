// init.js
document.addEventListener('DOMContentLoaded', () => {
  const isMobile =
    /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  if (isMobile) {
    alert(
      'PTCG-sim is still in mobile development. Please use a desktop for full functionality.'
    );
  }
});
