import React from 'react';
import '../styles/SkeletonLoader.css';

export const SkeletonPulse = (props) => (
  <div className={'skeleton-pulse ' + (props.className || '')} />
);

export const SkeletonCard = () => (
  <div className='skeleton-card'>
    <div className='skeleton-card-image' />
    <div className='skeleton-card-body'>
      <div className='skeleton-card-title' />
      <div className='skeleton-card-subtitle' />
      <div className='skeleton-card-row'>
        <div className='skeleton-card-tag' />
        <div className='skeleton-card-tag' />
      </div>
    </div>
  </div>
);

export const SkeletonProfile = () => (
  <div className='skeleton-profile'>
    <div className='skeleton-profile-header'>
      <div className='skeleton-avatar' />
      <div className='skeleton-name' />
      <div className='skeleton-location' />
    </div>
    <div className='skeleton-profile-body'>
      <div className='skeleton-block' />
      <div className='skeleton-block skeleton-block-short' />
      <div className='skeleton-block skeleton-block-shorter' />
    </div>
  </div>
);

export const SkeletonList = ({ count = 3 }) => (
  <div className='skeleton-list'>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className='skeleton-list-item'>
        <div className='skeleton-list-avatar' />
        <div className='skeleton-list-content'>
          <div className='skeleton-list-title' />
          <div className='skeleton-list-subtitle' />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonStats = () => (
  <div className='skeleton-stats'>
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className='skeleton-stat-item'>
        <div className='skeleton-stat-value' />
        <div className='skeleton-stat-label' />
      </div>
    ))}
  </div>
);

const SkeletonLoader = {
  Pulse: SkeletonPulse,
  Card: SkeletonCard,
  Profile: SkeletonProfile,
  List: SkeletonList,
  Stats: SkeletonStats
};

export default SkeletonLoader;
