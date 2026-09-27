const menuButton = document.querySelector('.menu-button');
const topLinks = document.querySelector('.toplinks');

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  topLinks?.classList.toggle('is-open', !open);
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => {
    if (menuButton?.getAttribute('aria-expanded') === 'true') {
      menuButton.click();
    }
  });
});
