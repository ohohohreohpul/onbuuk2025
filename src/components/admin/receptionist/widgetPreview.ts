/** Opens the shop's own chat widget on this page, so the owner can talk to the receptionist. */
export function openWidgetPreview(widgetKey: string): void {
  document.querySelectorAll('script[data-zenno-preview]').forEach((s) => s.remove());
  document.querySelectorAll<HTMLDivElement>('body > div').forEach((el) => { if (el.shadowRoot && el.style.zIndex === '2147483000') el.remove(); });
  (window as unknown as { __zennoReceptionist?: boolean }).__zennoReceptionist = false;
  const script = document.createElement('script');
  script.src = '/receptionist-widget.js';
  script.async = true;
  script.dataset.key = widgetKey;
  script.dataset.open = 'true';
  script.dataset.zennoPreview = 'true';
  document.body.appendChild(script);
}
