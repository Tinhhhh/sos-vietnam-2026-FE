import { useCallback, useState } from 'react';
import { Outlet } from 'react-router';

import { CitizenDock } from '@/components/layouts/citizen-layout/citizen-dock';
import { CitizenLayout } from '@/components/layouts/citizen-layout/citizen-layout';
import { useToast } from '@/components/ui/toast/toast-context';
import { paths } from '@/config/paths';
import { FamilySosModal } from '@/features/family-sos/components/family-sos-modal';
import { useGeolocation } from '@/features/location/hooks/use-geolocation';
import { InstallShortcutModal } from '@/features/pwa/components/install-shortcut-modal';
import { SurvivalGuideModal } from '@/features/survival-guide/components/survival-guide-modal';

/**
 * Citizen portal shell. Owns the state several features share — the GPS
 * position and which dock modal is open — and passes it down, so features
 * never import each other.
 */
export function CitizenRoot() {
  const geo = useGeolocation();
  const toast = useToast();
  const [openModal, setOpenModal] = useState(null);
  const closeModal = useCallback(() => setOpenModal(null), []);

  return (
    <CitizenLayout
      dock={
        <CitizenDock
          onInstallApp={() => setOpenModal('install')}
          onOpenFamilySos={() => setOpenModal('family')}
          onOpenSurvivalGuide={() => setOpenModal('guide')}
          dispatcherHref={paths.dispatcher.root.getHref()}
        />
      }
      overlay={
        <>
          <InstallShortcutModal open={openModal === 'install'} onClose={closeModal} />
          <FamilySosModal
            open={openModal === 'family'}
            onClose={closeModal}
            location={geo}
            notify={toast.show}
          />
          <SurvivalGuideModal open={openModal === 'guide'} onClose={closeModal} />
        </>
      }
    >
      <Outlet context={{ geo }} />
    </CitizenLayout>
  );
}
