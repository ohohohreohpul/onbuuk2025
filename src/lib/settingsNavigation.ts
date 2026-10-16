/** Opening a Settings tab from elsewhere (e.g. the setup banner), also when Settings is already open. */
export const SETTINGS_TAB_EVENT = 'zenno:settings-tab';

export function requestSettingsTab(tab: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState(window.history.state, '', url);
  window.dispatchEvent(new CustomEvent<string>(SETTINGS_TAB_EVENT, { detail: tab }));
}
