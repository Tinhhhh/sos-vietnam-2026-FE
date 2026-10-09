import { AmbientBubbles } from './ambient-bubbles';
import { CitizenBackground } from './citizen-background';
import styles from './citizen-layout.module.css';

/**
 * Citizen portal frame: ambient background + bottom dock + main column.
 * Anything rendered outside the main column (modals) goes in `overlay`.
 */
export function CitizenLayout({ dock, overlay, children }) {
  return (
    <>
      <AmbientBubbles />
      <CitizenBackground />
      {dock}
      <main className={styles.mainWrapper}>{children}</main>
      {overlay}
    </>
  );
}
