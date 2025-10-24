export default {
  // Let the template decide via {{#if currentUser}}. Avoid over-gating so the component always renders when logged in.
  shouldRender() {
    return true;
  },
};
