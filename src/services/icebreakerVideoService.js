/**
 * Icebreaker Video Service
 * Frontend API wrapper for icebreaker video functionality
 */

class IcebreakerVideoService {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }

  /**
   * Get auth token from localStorage
   */
  getAuthToken() {
    return localStorage.getItem('authToken');
  }

  /**
   * Get request headers
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getAuthToken()}`,
    };
  }

  /**
   * Upload a new icebreaker video
   */
  async uploadVideo(videoData) {
    try {
      const response = await fetch(
        `${this.baseURL}/icebreaker-videos/upload`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(videoData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Upload video error:', error);
      throw error;
    }
  }

  /**
   * Get user's own videos
   */
  async getMyVideos() {
    try {
      const response = await fetch(
        `${this.baseURL}/icebreaker-videos/my-videos`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }

      return await response.json();
    } catch (error) {
      console.error('Get my videos error:', error);
      throw error;
    }
  }

  /**
   * Get user's active intro video
   */
  async getMyActiveVideo() {
    try {
      const response = await fetch(
        `${this.baseURL}/icebreaker-videos/my-active`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch active video');
      }

      return await response.json();
    } catch (error) {
      console.error('Get active video error:', error);
      throw error;
    }
  }

  /**
   * Get a matched user's icebreaker video
   */
  async getMatchVideo(userId) {
    try {
      const response = await fetch(
        `${this.baseURL}/icebreaker-videos/match/${userId}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Video not found');
      }

      return await response.json();
    } catch (error) {
      console.error('Get match video error:', error);
      throw error;
    }
  }

  /**
   * Rate an icebreaker video
   */
  async rateVideo(videoId, ratingData) {
    try {
      const response = await fetch(
        `${this.baseURL}/icebreaker-videos/${videoId}/rate`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(ratingData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Rating failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Rate video error:', error);
      throw error;
    }
  }

  /**
   * Get video stats (owner only)
   */
  async getVideoStats(videoId) {
    try {
      const response = await fetch(
        `${this.baseURL}/icebreaker-videos/${videoId}/stats`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      return await response.json();
    } catch (error) {
      console.error('Get video stats error:', error);
      throw error;
    }
  }

  /**
   * Delete a video
   */
  async deleteVideo(videoId, videoKey) {
    try {
      const response = await fetch(
        `${this.baseURL}/icebreaker-videos/${videoId}`,
        {
          method: 'DELETE',
          headers: this.getHeaders(),
          body: JSON.stringify({ videoKey }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Delete video error:', error);
      throw error;
    }
  }

  /**
   * Get featured videos (for discovery)
   */
  async getFeaturedVideos(limit = 12) {
    try {
      const response = await fetch(
        `${this.baseURL}/icebreaker-videos/featured?limit=${limit}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch featured videos');
      }

      return await response.json();
    } catch (error) {
      console.error('Get featured videos error:', error);
      throw error;
    }
  }

  /**
   * Get trending videos
   */
  async getTrendingVideos(limit = 20, daysBack = 7) {
    try {
      const response = await fetch(
        `${this.baseURL}/icebreaker-videos/trending?limit=${limit}&daysBack=${daysBack}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch trending videos');
      }

      return await response.json();
    } catch (error) {
      console.error('Get trending videos error:', error);
      throw error;
    }
  }

  /**
   * Convert duration in milliseconds to readable format
   */
  formatDuration(seconds) {
    return `${Math.floor(seconds / 1000)}s`;
  }

  /**
   * Generate thumbnail from video (simplified - in production use server-side)
   */
  generateThumbnail(videoBlob) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
          resolve(URL.createObjectURL(blob));
        });
      };
      video.src = URL.createObjectURL(videoBlob);
    });
  }
}

// Export singleton instance
export default new IcebreakerVideoService();
