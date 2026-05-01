const { PhotoABTest, PhotoABTestResult, User, DatingProfile, ProfilePhoto } = require('../models');
const { Op, Sequelize } = require('sequelize');

const photoABTestService = {
  /**
   * Create a new A/B test
   * @param {number} userId - ID of the user running the test
   * @param {number} photoAId - ID of photo A
   * @param {number} photoBId - ID of photo B
   * @param {string} testName - Optional name for the test
   * @param {number} durationHours - Duration of test (default 48)
   * @returns {Promise} The created test
   */
  async createTest(userId, photoAId, photoBId, testName = null, durationHours = 48) {
    try {
      // Validate that both photos exist and belong to the user
      const profile = await DatingProfile.findOne({
        where: { userId },
        include: [
          {
            model: ProfilePhoto,
            where: {
              id: {
                [Op.in]: [photoAId, photoBId]
              }
            }
          }
        ]
      });

      if (!profile || profile.ProfilePhotos.length < 2) {
        throw new Error('One or both photos do not exist or do not belong to this user');
      }

      // Check if user already has an active test
      const activeTest = await PhotoABTest.findOne({
        where: {
          userId,
          status: 'active'
        }
      });

      if (activeTest) {
        throw new Error('User already has an active A/B test running');
      }

      // Create the test
      const test = await PhotoABTest.create({
        userId,
        photoAId,
        photoBId,
        testName,
        testDurationHours: durationHours,
        status: 'active',
        startedAt: new Date()
      });

      return test;
    } catch (error) {
      throw new Error(`Failed to create A/B test: ${error.message}`);
    }
  },

  /**
   * Record a like event during test
   * @param {number} testId - ID of the test
   * @param {number} likerUserId - User who liked the profile
   * @param {number} photoId - Photo that was liked
   * @param {string} photoVersion - 'A' or 'B'
   * @returns {Promise}
   */
  async recordLike(testId, likerUserId, photoId, photoVersion) {
    try {
      const test = await PhotoABTest.findByPk(testId);
      if (!test) throw new Error('Test not found');
      if (test.status !== 'active') throw new Error('Test is not active');

      // Record the result
      await PhotoABTestResult.create({
        testId,
        userId: test.userId,
        likerUserId,
        photoId,
        photoVersion,
        eventType: 'like'
      });

      // Update the like count
      if (photoVersion === 'A') {
        test.likesA += 1;
      } else {
        test.likesB += 1;
      }

      await test.save();
      return test;
    } catch (error) {
      throw new Error(`Failed to record like: ${error.message}`);
    }
  },

  /**
   * Record a view event
   * @param {number} testId - ID of the test
   * @param {number} viewerUserId - User who viewed the profile
   * @param {string} photoVersion - 'A' or 'B'
   * @returns {Promise}
   */
  async recordView(testId, viewerUserId, photoVersion) {
    try {
      const test = await PhotoABTest.findByPk(testId);
      if (!test) throw new Error('Test not found');
      if (test.status !== 'active') throw new Error('Test is not active');

      // Record the result
      await PhotoABTestResult.create({
        testId,
        userId: test.userId,
        likerUserId: viewerUserId,
        photoId: photoVersion === 'A' ? test.photoAId : test.photoBId,
        photoVersion,
        eventType: 'view'
      });

      // Update the view count
      if (photoVersion === 'A') {
        test.viewsA += 1;
      } else {
        test.viewsB += 1;
      }

      await test.save();
      return test;
    } catch (error) {
      throw new Error(`Failed to record view: ${error.message}`);
    }
  },

  /**
   * Calculate engagement rates and check for completion
   * @param {number} testId - ID of the test
   * @returns {Promise} Updated test with engagement rates
   */
  async updateMetrics(testId) {
    try {
      const test = await PhotoABTest.findByPk(testId);
      if (!test) throw new Error('Test not found');

      // Calculate engagement rates (avoid division by zero)
      test.engagementA = test.viewsA > 0 ? (test.likesA / test.viewsA) * 100 : 0;
      test.engagementB = test.viewsB > 0 ? (test.likesB / test.viewsB) * 100 : 0;

      // Check if test duration has elapsed
      const testStart = new Date(test.startedAt);
      const testEnd = new Date(testStart.getTime() + test.testDurationHours * 60 * 60 * 1000);
      const now = new Date();

      if (now >= testEnd && test.status === 'active') {
        // Test is complete - determine winner
        test.status = 'completed';
        test.completedAt = now;

        const totalA = test.likesA + test.viewsA;
        const totalB = test.likesB + test.viewsB;

        // Determine winner based on engagement rate
        if (test.engagementA > test.engagementB) {
          test.winner = 'A';
          test.winMargin = test.engagementA - test.engagementB;
        } else if (test.engagementB > test.engagementA) {
          test.winner = 'B';
          test.winMargin = test.engagementB - test.engagementA;
        } else {
          test.winner = 'tie';
          test.winMargin = 0;
        }

        // Auto-promote winner to position 1
        if (test.winner !== 'tie') {
          const winningPhotoId = test.winner === 'A' ? test.photoAId : test.photoBId;
          await this.promoteWinnerPhoto(test.userId, winningPhotoId);
          test.promotedPhotoId = winningPhotoId;
          test.autoPromoted = true;
        }
      }

      await test.save();
      return test;
    } catch (error) {
      throw new Error(`Failed to update metrics: ${error.message}`);
    }
  },

  /**
   * Promote a photo to position 1
   * @param {number} userId - ID of the user
   * @param {number} photoId - ID of the photo to promote
   * @returns {Promise}
   */
  async promoteWinnerPhoto(userId, photoId) {
    try {
      const profile = await DatingProfile.findOne({ where: { userId } });
      if (!profile) throw new Error('Profile not found');

      // Get current photo order
      const photos = await ProfilePhoto.findAll({
        where: { profileId: profile.id },
        order: [['displayOrder', 'ASC']]
      });

      // Find the winning photo and current #1 photo
      const winningPhoto = photos.find(p => p.id === photoId);
      const currentFirst = photos[0];

      if (!winningPhoto) throw new Error('Photo not found');

      // Swap positions if winner is not already first
      if (winningPhoto.id !== currentFirst.id) {
        const tempOrder = winningPhoto.displayOrder;
        winningPhoto.displayOrder = currentFirst.displayOrder;
        currentFirst.displayOrder = tempOrder;

        await winningPhoto.save();
        await currentFirst.save();
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to promote photo: ${error.message}`);
    }
  },

  /**
   * Get test details with current metrics
   * @param {number} testId - ID of the test
   * @param {number} userId - ID of user (for auth check)
   * @returns {Promise} Test details
   */
  async getTestDetails(testId, userId) {
    try {
      const test = await PhotoABTest.findByPk(testId);
      if (!test) throw new Error('Test not found');
      if (test.userId !== userId) throw new Error('Unauthorized');

      // Update metrics before returning
      await this.updateMetrics(testId);

      // Fetch fresh copy with updated metrics
      return await PhotoABTest.findByPk(testId);
    } catch (error) {
      throw new Error(`Failed to get test details: ${error.message}`);
    }
  },

  /**
   * Get all tests for a user with filters
   * @param {number} userId - ID of the user
   * @param {string} status - Filter by status ('active', 'completed', 'paused')
   * @param {number} limit - Max results to return
   * @param {number} offset - Pagination offset
   * @returns {Promise} Array of tests
   */
  async getUserTests(userId, status = null, limit = 10, offset = 0) {
    try {
      const where = { userId };
      if (status) where.status = status;

      const tests = await PhotoABTest.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      // Update metrics for active tests
      for (const test of tests) {
        if (test.status === 'active') {
          await this.updateMetrics(test.id);
        }
      }

      return tests;
    } catch (error) {
      throw new Error(`Failed to get user tests: ${error.message}`);
    }
  },

  /**
   * Get test results (likes/views breakdown)
   * @param {number} testId - ID of the test
   * @param {number} userId - ID of user (for auth check)
   * @returns {Promise} Detailed results
   */
  async getTestResults(testId, userId) {
    try {
      const test = await PhotoABTest.findByPk(testId);
      if (!test) throw new Error('Test not found');
      if (test.userId !== userId) throw new Error('Unauthorized');

      const results = await PhotoABTestResult.findAll({
        where: { testId },
        attributes: ['photoVersion', 'eventType', 'timestamp'],
        order: [['timestamp', 'DESC']]
      });

      // Organize results
      const likesA = results.filter(r => r.photoVersion === 'A' && r.eventType === 'like').length;
      const likesB = results.filter(r => r.photoVersion === 'B' && r.eventType === 'like').length;
      const viewsA = results.filter(r => r.photoVersion === 'A' && r.eventType === 'view').length;
      const viewsB = results.filter(r => r.photoVersion === 'B' && r.eventType === 'view').length;

      return {
        test,
        likesA,
        likesB,
        viewsA,
        viewsB,
        engagementA: viewsA > 0 ? (likesA / viewsA) * 100 : 0,
        engagementB: viewsB > 0 ? (likesB / viewsB) * 100 : 0,
        totalEvents: results.length,
        timeline: results
      };
    } catch (error) {
      throw new Error(`Failed to get test results: ${error.message}`);
    }
  },

  /**
   * Pause a test
   * @param {number} testId - ID of the test
   * @param {number} userId - ID of user (for auth check)
   * @returns {Promise}
   */
  async pauseTest(testId, userId) {
    try {
      const test = await PhotoABTest.findByPk(testId);
      if (!test) throw new Error('Test not found');
      if (test.userId !== userId) throw new Error('Unauthorized');

      test.status = 'paused';
      await test.save();
      return test;
    } catch (error) {
      throw new Error(`Failed to pause test: ${error.message}`);
    }
  },

  /**
   * Resume a paused test
   * @param {number} testId - ID of the test
   * @param {number} userId - ID of user (for auth check)
   * @returns {Promise}
   */
  async resumeTest(testId, userId) {
    try {
      const test = await PhotoABTest.findByPk(testId);
      if (!test) throw new Error('Test not found');
      if (test.userId !== userId) throw new Error('Unauthorized');
      if (test.status !== 'paused') throw new Error('Test is not paused');

      test.status = 'active';
      await test.save();
      return test;
    } catch (error) {
      throw new Error(`Failed to resume test: ${error.message}`);
    }
  },

  /**
   * End a test early and determine winner
   * @param {number} testId - ID of the test
   * @param {number} userId - ID of user (for auth check)
   * @returns {Promise}
   */
  async endTestEarly(testId, userId) {
    try {
      const test = await PhotoABTest.findByPk(testId);
      if (!test) throw new Error('Test not found');
      if (test.userId !== userId) throw new Error('Unauthorized');

      // Update metrics and finalize
      await this.updateMetrics(testId);
      return await PhotoABTest.findByPk(testId);
    } catch (error) {
      throw new Error(`Failed to end test: ${error.message}`);
    }
  },

  /**
   * Get insights and recommendations from test results
   * @param {number} testId - ID of the test
   * @param {number} userId - ID of user (for auth check)
   * @returns {Promise} Insights object
   */
  async getTestInsights(testId, userId) {
    try {
      const test = await PhotoABTest.findByPk(testId);
      if (!test) throw new Error('Test not found');
      if (test.userId !== userId) throw new Error('Unauthorized');

      const results = await this.getTestResults(testId, userId);
      const insights = {
        testStatus: test.status,
        winner: test.winner,
        winMargin: test.winMargin,
        recommendations: [],
        insights: []
      };

      if (test.status === 'active') {
        const timeElapsed = (new Date() - test.startedAt) / (1000 * 60 * 60);
        const timeRemaining = test.testDurationHours - timeElapsed;
        insights.insights.push(`Test has been running for ${Math.round(timeElapsed)} hours. ${Math.round(timeRemaining)} hours remaining.`);

        // Suggest sample size for statistical significance
        const totalInteractions = results.likesA + results.likesB + results.viewsA + results.viewsB;
        if (totalInteractions < 50) {
          insights.recommendations.push('Continue test to gather more data for meaningful insights');
        }
      }

      if (test.winner === 'A') {
        insights.insights.push(`Photo A is winning with ${results.engagementA.toFixed(1)}% engagement vs ${results.engagementB.toFixed(1)}% for Photo B`);
      } else if (test.winner === 'B') {
        insights.insights.push(`Photo B is winning with ${results.engagementB.toFixed(1)}% engagement vs ${results.engagementA.toFixed(1)}% for Photo A`);
      } else if (test.winner === 'tie') {
        insights.insights.push('Photos are performing equally well');
      }

      if (test.autoPromoted && test.promotedPhotoId) {
        insights.recommendations.push(`Winner was automatically promoted to position 1`);
      }

      return insights;
    } catch (error) {
      throw new Error(`Failed to get test insights: ${error.message}`);
    }
  }
};

module.exports = photoABTestService;
