import React, { useState, useEffect } from 'react';
import { Clock, Lock, CheckCircle2 } from 'lucide-react';

export const DeadlineCountdown = ({ submissionDeadline, isClosed = false, compact = false }) => {
  const [timeLeft, setTimeLeft] = useState(null);
  const [expired, setExpired] = useState(isClosed);

  useEffect(() => {
    if (!submissionDeadline) return;

    const calculateTime = () => {
      const target = new Date(submissionDeadline).getTime();
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0 || isClosed) {
        setExpired(true);
        setTimeLeft(null);
      } else {
        setExpired(false);
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [submissionDeadline, isClosed]);

  if (!submissionDeadline) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[11px] font-semibold text-emerald-300">
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        OPEN (Indefinite)
      </span>
    );
  }

  if (expired) {
    return (
      <span
        title={`Submission Deadline passed at ${new Date(submissionDeadline).toLocaleString()}`}
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/15 border border-rose-500/40 rounded-lg text-[11px] font-bold text-rose-300 shadow-sm"
      >
        <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        CLOSED
      </span>
    );
  }

  if (!timeLeft) return null;

  const formattedDeadline = new Date(submissionDeadline).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <span
      title={`Submission Deadline: ${formattedDeadline}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/15 border border-indigo-500/30 rounded-lg text-[11px] font-semibold text-indigo-200"
    >
      <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse shrink-0" />
      <span>
        {timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}
        {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s remaining
      </span>
    </span>
  );
};
