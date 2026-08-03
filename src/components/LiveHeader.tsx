import React from 'react';
import Header from './Header';
import { useDisplayNow } from '../hooks/useDisplayNow';

/** Header の既存 timer props 契約を保ったまま、時刻更新を Header の親から分離する。 */
const LiveHeader: React.FC<Omit<React.ComponentProps<typeof Header>, 'now'>> = (props) => {
  const now = useDisplayNow(1000);
  return <Header {...props} now={now} />;
};

export default LiveHeader;
