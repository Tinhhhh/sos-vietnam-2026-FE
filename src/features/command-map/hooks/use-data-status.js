import { useEffect, useState } from 'react';

import { getDataStatus } from '../api/geo';

/** Version info of boundaries and rescue stations (null = endpoint not available). */
export function useDataStatus() {
  const [state, setState] = useState({ loading: true, items: null });

  useEffect(() => {
    let alive = true;
    getDataStatus().then((items) => alive && setState({ loading: false, items }));
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
