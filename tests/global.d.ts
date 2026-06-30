/**
 * Global type declarations for the test environment.
 */

// Extend Window with jojoclient bridge for component tests.
// In jsdom, we manually set window.jojoclient from the IPC mock.
declare global {
  interface Window {
    jojoclient?: import("./helpers/ipc-mock").JojoclientMock;
  }
}

export {};
