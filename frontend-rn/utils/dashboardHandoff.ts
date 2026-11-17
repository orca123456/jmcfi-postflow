// Native navigation retains the platform's normal transition.
export function beginDashboardHandoff(navigate: () => void) { navigate(); }
export function completeDashboardHandoff() {}
