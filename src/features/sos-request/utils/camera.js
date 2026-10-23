/** Can this browser open the camera inside the page? Otherwise the form falls back to the phone's camera app. */
export function canUseInPageCamera() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}
