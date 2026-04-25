import React from 'react';
import { getEntityId } from './utils';

const ReadReceipts = ({ deliveryStatus = [], currentUserId = '' }) => {
  const recipientStatuses = deliveryStatus.filter(
    (status) => getEntityId(status.userId) !== currentUserId
  );

  if (recipientStatuses.length === 0) {
    return null;
  }

  const seenStatuses = recipientStatuses.filter((status) => status.status === 'seen');
  const deliveredStatuses = recipientStatuses.filter(
    (status) => status.status === 'delivered'
  );
  const totalRecipients = recipientStatuses.length;

  let status = 'sent';
  let statusLabel = 'Sent';
  let tooltip = 'Sent';

  if (seenStatuses.length === totalRecipients) {
    status = 'seen';
    statusLabel = 'Seen';
    const latestSeenAt = seenStatuses
      .map((entry) => entry.seenAt)
      .filter(Boolean)
      .sort()
      .pop();
    tooltip = latestSeenAt
      ? `Seen by everyone at ${new Date(latestSeenAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : 'Seen by everyone';
  } else if (seenStatuses.length > 0 || deliveredStatuses.length > 0) {
    status = seenStatuses.length > 0 ? 'partially-seen' : 'delivered';
    statusLabel =
      seenStatuses.length > 0
        ? `Seen ${seenStatuses.length}/${totalRecipients}`
        : 'Delivered';
    tooltip =
      seenStatuses.length > 0
        ? `Seen by ${seenStatuses.length} of ${totalRecipients} recipient(s)`
        : 'Delivered';
  }

  return (
    <span className={`read-receipt ${status}`} title={tooltip}>
      {statusLabel}
    </span>
  );
};

export default ReadReceipts;
