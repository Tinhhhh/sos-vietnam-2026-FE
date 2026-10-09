import { useOutletContext } from 'react-router';

import { useToast } from '@/components/ui/toast/toast-context';
import { LocationBanner } from '@/features/location/components/location-banner';
import { SosHero } from '@/features/sos-trigger/components/sos-hero';
import { useNetworkStatus } from '@/hooks/use-network-status';

/** "/" — SOS trigger screen (legacy #sosTriggerView). */
export function CitizenHomeRoute() {
  const { geo } = useOutletContext();
  const { label: networkLabel } = useNetworkStatus();
  const toast = useToast();

  // The SOS request form is the next module; until then confirm the tap.
  const handleSosTrigger = () => {
    toast.show('Đã nhận thao tác SOS. Form báo sự cố sẽ có ở Module 2.', { tone: 'warning' });
  };

  return (
    <div>
      <LocationBanner geo={geo} networkLabel={networkLabel} />
      <SosHero onTrigger={handleSosTrigger} />
    </div>
  );
}
