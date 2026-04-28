/**
 * Double Dates Service
 * Handles all business logic for double dates, friend verification, and group coordination
 */

const { Op, Sequelize } = require('sequelize');
const {
  DoubleDateRequest,
  DoubleDateGroup,
  FriendVerification,
  DoubleDateRating,
  User,
  Match,
  FriendRelationship,
  Chatroom,
  ChatroomMember
} = require('../models');

class DoubleDateService {
  /**
   * Create a double date request
   * Validates that:
   * 1. User1 and User2 are matched
   * 2. Friend1 and Friend2 are matched
   * 3. User1 and Friend1 are friends
   * 4. User2 and Friend2 are friends
   */
  static async createDoubleDateRequest(userId, data) {
    try {
      const {
        matchId,
        friendId,
        friendMatchId,
        proposedDate,
        proposedLocation,
        proposedActivity,
        message
      } = data;

      // Get match info for user (userId with user2Id)
      const match1 = await Match.findByPk(matchId, {
        include: [
          { model: User, as: 'user1', attributes: ['id', 'firstName', 'lastName'] },
          { model: User, as: 'user2', attributes: ['id', 'firstName', 'lastName'] }
        ]
      });

      if (!match1) {
        return { success: false, message: 'Match not found' };
      }

      // Determine user IDs in the first match
      const user1Id = match1.user_id_1;
      const user2Id = match1.user_id_2;

      // Verify userId is part of match1
      if (userId !== user1Id && userId !== user2Id) {
        return { success: false, message: 'You are not part of this match' };
      }

      // Get the other user in the first match
      const otherUserId = userId === user1Id ? user2Id : user1Id;

      // Get match info for friend (friendId with friendMatchId)
      const match2 = await Match.findByPk(friendMatchId, {
        include: [
          { model: User, as: 'user1', attributes: ['id', 'firstName', 'lastName'] },
          { model: User, as: 'user2', attributes: ['id', 'firstName', 'lastName'] }
        ]
      });

      if (!match2) {
        return { success: false, message: 'Friend match not found' };
      }

      const friend1Id = match2.user_id_1;
      const friend2Id = match2.user_id_2;

      // Verify friendId is part of match2
      if (friendId !== friend1Id && friendId !== friend2Id) {
        return { success: false, message: 'Friend is not part of that match' };
      }

      const otherFriendId = friendId === friend1Id ? friend2Id : friend1Id;

      // Check if user and friend are actually friends
      const friendship = await FriendRelationship.findOne({
        where: {
          [Op.or]: [
            { user_id_1: userId, user_id_2: friendId, status: 'accepted' },
            { user_id_1: friendId, user_id_2: userId, status: 'accepted' }
          ]
        }
      });

      if (!friendship) {
        return { success: false, message: 'You must be friends with this person' };
      }

      // Check if other user and other friend are friends
      const otherFriendship = await FriendRelationship.findOne({
        where: {
          [Op.or]: [
            { user_id_1: otherUserId, user_id_2: otherFriendId, status: 'accepted' },
            { user_id_1: otherFriendId, user_id_2: otherUserId, status: 'accepted' }
          ]
        }
      });

      if (!otherFriendship) {
        return {
          success: false,
          message: 'Your match and their friend must be friends with each other'
        };
      }

      // Check for existing request
      const existingRequest = await DoubleDateRequest.findOne({
        where: {
          [Op.or]: [
            {
              user_id_1: userId,
              user_id_2: otherUserId,
              friend_id_1: friendId,
              friend_id_2: otherFriendId,
              status: { [Op.ne]: 'rejected' }
            },
            {
              user_id_1: otherUserId,
              user_id_2: userId,
              friend_id_1: otherFriendId,
              friend_id_2: friendId,
              status: { [Op.ne]: 'rejected' }
            }
          ]
        }
      });

      if (existingRequest) {
        return { success: false, message: 'A request already exists for these pairs' };
      }

      // Create request
      const request = await DoubleDateRequest.create({
        user_id_1: userId,
        user_id_2: otherUserId,
        friend_id_1: friendId,
        friend_id_2: otherFriendId,
        initiated_by: userId,
        status: 'pending',
        proposed_date: proposedDate || null,
        proposed_location: proposedLocation || null,
        proposed_activity: proposedActivity || null,
        message: message || null
      });

      // Create friend verification record for optional friend approval
      await FriendVerification.create({
        user_id: userId,
        match_id: matchId,
        friend_id: friendId,
        status: 'pending_approval'
      });

      return {
        success: true,
        message: 'Double date request created successfully',
        requestId: request.id
      };
    } catch (error) {
      console.error('Error creating double date request:', error);
      return { success: false, message: 'Error creating request' };
    }
  }

  /**
   * Get pending double date requests for a user
   */
  static async getPendingRequests(userId) {
    try {
      const requests = await DoubleDateRequest.findAll({
        where: {
          [Op.or]: [
            { user_id_1: userId },
            { user_id_2: userId },
            { friend_id_1: userId },
            { friend_id_2: userId }
          ],
          status: 'pending'
        },
        include: [
          { model: User, as: 'user1', attributes: ['id', 'firstName', 'lastName', 'profile_photo_url'] },
          { model: User, as: 'user2', attributes: ['id', 'firstName', 'lastName', 'profile_photo_url'] },
          { model: User, as: 'friend1', attributes: ['id', 'firstName', 'lastName', 'profile_photo_url'] },
          { model: User, as: 'friend2', attributes: ['id', 'firstName', 'lastName', 'profile_photo_url'] },
          { model: User, as: 'initiator', attributes: ['id', 'firstName', 'lastName'] }
        ],
        order: [['created_at', 'DESC']]
      });

      return {
        success: true,
        requests: requests.map(r => ({
          id: r.id,
          initiatorId: r.initiated_by,
          pairs: {
            pair1: {
              user1: r.user1,
              user2: r.user2,
              matchId: null // Could be fetched separately if needed
            },
            pair2: {
              friend1: r.friend1,
              friend2: r.friend2
            }
          },
          proposedDate: r.proposed_date,
          proposedLocation: r.proposed_location,
          proposedActivity: r.proposed_activity,
          message: r.message,
          createdAt: r.created_at
        }))
      };
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      return { success: false, message: 'Error fetching requests' };
    }
  }

  /**
   * Approve a double date request
   */
  static async approveRequest(requestId, userId) {
    try {
      const request = await DoubleDateRequest.findByPk(requestId);

      if (!request) {
        return { success: false, message: 'Request not found' };
      }

      // Determine which approval this is
      let newStatus = request.status;
      const approvalTime = new Date();

      if (userId === request.user_id_1 && !request.user_1_approved_at) {
        await request.update({ user_1_approved_at: approvalTime });
        newStatus = request.user_2_approved_at ? 'accepted_by_user_2' : 'accepted_by_user_1';
      } else if (userId === request.user_id_2 && !request.user_2_approved_at) {
        await request.update({ user_2_approved_at: approvalTime });
        newStatus = request.user_1_approved_at ? 'accepted_by_user_1' : 'accepted_by_user_2';
      } else if (userId === request.friend_id_1 && !request.friend_1_approved_at) {
        await request.update({ friend_1_approved_at: approvalTime });
        newStatus = request.friend_2_approved_at ? 'accepted_by_friend_2' : 'accepted_by_friend_1';
      } else if (userId === request.friend_id_2 && !request.friend_2_approved_at) {
        await request.update({ friend_2_approved_at: approvalTime });
        newStatus = request.friend_1_approved_at ? 'accepted_by_friend_1' : 'accepted_by_friend_2';
      } else {
        return { success: false, message: 'Invalid approval' };
      }

      // Check if all have approved
      if (
        request.user_1_approved_at &&
        request.user_2_approved_at &&
        request.friend_1_approved_at &&
        request.friend_2_approved_at
      ) {
        // Create double date group
        const group = await DoubleDateGroup.create({
          user_id_1: request.user_id_1,
          user_id_2: request.user_id_2,
          friend_id_1: request.friend_id_1,
          friend_id_2: request.friend_id_2,
          scheduled_date: request.proposed_date,
          location: request.proposed_location,
          activity: request.proposed_activity,
          notes: request.message,
          status: 'scheduled'
        });

        // Create group chatroom for all 4
        const chatroom = await Chatroom.create({
          name: `Double Date: ${group.id}`,
          description: `Group chat for double date ${group.id}`,
          is_public: false,
          capacity: 4,
          creator_id: request.initiated_by
        });

        // Add all 4 users to chatroom
        const members = [
          request.user_id_1,
          request.user_id_2,
          request.friend_id_1,
          request.friend_id_2
        ];

        await ChatroomMember.bulkCreate(
          members.map(userId => ({
            chatroom_id: chatroom.id,
            user_id: userId,
            joined_at: new Date()
          }))
        );

        // Update request and group
        await request.update({
          status: 'all_accepted',
          double_date_group_id: group.id
        });

        await group.update({ chatroom_id: chatroom.id });

        return {
          success: true,
          message: 'Double date approved! Group created with chat',
          groupId: group.id,
          chatroomId: chatroom.id,
          status: 'all_accepted'
        };
      }

      await request.update({ status: newStatus });

      return {
        success: true,
        message: 'Request approved',
        status: newStatus
      };
    } catch (error) {
      console.error('Error approving request:', error);
      return { success: false, message: 'Error approving request' };
    }
  }

  /**
   * Reject a double date request
   */
  static async rejectRequest(requestId, userId) {
    try {
      const request = await DoubleDateRequest.findByPk(requestId);

      if (!request) {
        return { success: false, message: 'Request not found' };
      }

      // Check if user is part of request
      if (
        userId !== request.user_id_1 &&
        userId !== request.user_id_2 &&
        userId !== request.friend_id_1 &&
        userId !== request.friend_id_2
      ) {
        return { success: false, message: 'Not authorized' };
      }

      await request.update({ status: 'rejected' });

      return { success: true, message: 'Request rejected' };
    } catch (error) {
      console.error('Error rejecting request:', error);
      return { success: false, message: 'Error rejecting request' };
    }
  }

  /**
   * Get active double date groups for a user
   */
  static async getActiveGroups(userId) {
    try {
      const groups = await DoubleDateGroup.findAll({
        where: {
          [Op.or]: [
            { user_id_1: userId },
            { user_id_2: userId },
            { friend_id_1: userId },
            { friend_id_2: userId }
          ],
          status: { [Op.ne]: 'cancelled' }
        },
        include: [
          { model: User, as: 'user1', attributes: ['id', 'firstName', 'lastName', 'profile_photo_url', 'age'] },
          { model: User, as: 'user2', attributes: ['id', 'firstName', 'lastName', 'profile_photo_url', 'age'] },
          { model: User, as: 'friend1', attributes: ['id', 'firstName', 'lastName', 'profile_photo_url', 'age'] },
          { model: User, as: 'friend2', attributes: ['id', 'firstName', 'lastName', 'profile_photo_url', 'age'] }
        ],
        order: [['scheduled_date', 'ASC']]
      });

      return {
        success: true,
        groups: groups.map(g => ({
          id: g.id,
          participants: [
            { id: g.user1.id, name: g.user1.firstName, photo: g.user1.profile_photo_url },
            { id: g.user2.id, name: g.user2.firstName, photo: g.user2.profile_photo_url },
            { id: g.friend1.id, name: g.friend1.firstName, photo: g.friend1.profile_photo_url },
            { id: g.friend2.id, name: g.friend2.firstName, photo: g.friend2.profile_photo_url }
          ],
          scheduledDate: g.scheduled_date,
          location: g.location,
          activity: g.activity,
          status: g.status,
          chatroomId: g.chatroom_id,
          createdAt: g.created_at
        }))
      };
    } catch (error) {
      console.error('Error fetching double date groups:', error);
      return { success: false, message: 'Error fetching groups' };
    }
  }

  /**
   * Mark double date as completed
   */
  static async markCompleted(groupId, userId) {
    try {
      const group = await DoubleDateGroup.findByPk(groupId);

      if (!group) {
        return { success: false, message: 'Group not found' };
      }

      // Check if user is part of group
      if (
        userId !== group.user_id_1 &&
        userId !== group.user_id_2 &&
        userId !== group.friend_id_1 &&
        userId !== group.friend_id_2
      ) {
        return { success: false, message: 'Not authorized' };
      }

      await group.update({
        status: 'completed',
        marked_completed_by: userId,
        completed_at: new Date()
      });

      return { success: true, message: 'Double date marked as completed' };
    } catch (error) {
      console.error('Error marking completed:', error);
      return { success: false, message: 'Error marking completed' };
    }
  }

  /**
   * Rate a double date
   */
  static async rateDoubleDate(groupId, userId, ratings) {
    try {
      const group = await DoubleDateGroup.findByPk(groupId);

      if (!group) {
        return { success: false, message: 'Group not found' };
      }

      // Check if user is part of group
      if (
        userId !== group.user_id_1 &&
        userId !== group.user_id_2 &&
        userId !== group.friend_id_1 &&
        userId !== group.friend_id_2
      ) {
        return { success: false, message: 'Not authorized' };
      }

      // Check if already rated
      const existingRating = await DoubleDateRating.findOne({
        where: { double_date_group_id: groupId, user_id: userId }
      });

      const ratingData = {
        double_date_group_id: groupId,
        user_id: userId,
        overall_rating: ratings.overallRating,
        rating_for_user_2: ratings.ratingForUser2 || null,
        rating_for_friend_1: ratings.ratingForFriend1 || null,
        rating_for_friend_2: ratings.ratingForFriend2 || null,
        review: ratings.review || null,
        would_do_again: ratings.wouldDoAgain || null
      };

      let rating;
      if (existingRating) {
        await existingRating.update(ratingData);
        rating = existingRating;
      } else {
        rating = await DoubleDateRating.create(ratingData);
      }

      // Calculate average rating for group
      const allRatings = await DoubleDateRating.findAll({
        where: { double_date_group_id: groupId },
        attributes: ['overall_rating']
      });

      const avgRating =
        allRatings.length > 0
          ? (allRatings.reduce((sum, r) => sum + r.overall_rating, 0) / allRatings.length).toFixed(2)
          : null;

      return {
        success: true,
        message: 'Double date rated successfully',
        rating,
        groupAverageRating: avgRating,
        totalRatings: allRatings.length
      };
    } catch (error) {
      console.error('Error rating double date:', error);
      return { success: false, message: 'Error rating double date' };
    }
  }

  /**
   * Enable friend verification (let friends see your matches)
   */
  static async enableFriendVerification(userId, matchId, friendId) {
    try {
      const match = await Match.findByPk(matchId);

      if (!match) {
        return { success: false, message: 'Match not found' };
      }

      // Verify user is part of match
      if (userId !== match.user_id_1 && userId !== match.user_id_2) {
        return { success: false, message: 'Not part of this match' };
      }

      // Check friendship
      const friendship = await FriendRelationship.findOne({
        where: {
          [Op.or]: [
            { user_id_1: userId, user_id_2: friendId, status: 'accepted' },
            { user_id_1: friendId, user_id_2: userId, status: 'accepted' }
          ]
        }
      });

      if (!friendship) {
        return { success: false, message: 'Not friends with this user' };
      }

      // Create or update verification
      const verification = await FriendVerification.findOne({
        where: { user_id: userId, match_id: matchId, friend_id: friendId }
      });

      if (verification) {
        return { success: false, message: 'Already shared with this friend' };
      }

      await FriendVerification.create({
        user_id: userId,
        match_id: matchId,
        friend_id: friendId,
        status: 'pending_approval'
      });

      return { success: true, message: 'Match shared with friend for verification' };
    } catch (error) {
      console.error('Error enabling friend verification:', error);
      return { success: false, message: 'Error enabling friend verification' };
    }
  }

  /**
   * Get friend verifications for a user (matches shared with them)
   */
  static async getFriendVerifications(userId) {
    try {
      const verifications = await FriendVerification.findAll({
        where: { friend_id: userId },
        include: [
          { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'profile_photo_url', 'age'] },
          {
            model: Match,
            attributes: ['id'],
            include: [
              { model: User, as: 'user1', attributes: ['id', 'firstName', 'lastName', 'profile_photo_url', 'age'] },
              { model: User, as: 'user2', attributes: ['id', 'firstName', 'lastName', 'profile_photo_url', 'age'] }
            ]
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return {
        success: true,
        verifications: verifications.map(v => ({
          id: v.id,
          verificationStatus: v.status,
          sharedByUser: {
            id: v.user.id,
            name: v.user.firstName,
            photo: v.user.profile_photo_url
          },
          match: {
            id: v.Match.id,
            user1: {
              id: v.Match.user1.id,
              name: v.Match.user1.firstName,
              photo: v.Match.user1.profile_photo_url
            },
            user2: {
              id: v.Match.user2.id,
              name: v.Match.user2.firstName,
              photo: v.Match.user2.profile_photo_url
            }
          },
          feedback: v.friend_feedback,
          viewedAt: v.viewed_at
        }))
      };
    } catch (error) {
      console.error('Error fetching verifications:', error);
      return { success: false, message: 'Error fetching verifications' };
    }
  }

  /**
   * Approve or reject friend verification
   */
  static async respondToVerification(verificationId, userId, approved, feedback) {
    try {
      const verification = await FriendVerification.findByPk(verificationId);

      if (!verification) {
        return { success: false, message: 'Verification not found' };
      }

      if (verification.friend_id !== userId) {
        return { success: false, message: 'Not authorized' };
      }

      await verification.update({
        status: approved ? 'approved' : 'rejected',
        friend_feedback: feedback || null,
        viewed_at: new Date()
      });

      return {
        success: true,
        message: approved ? 'Match approved for double date consideration' : 'Match rejected'
      };
    } catch (error) {
      console.error('Error responding to verification:', error);
      return { success: false, message: 'Error responding to verification' };
    }
  }
}

module.exports = DoubleDateService;
