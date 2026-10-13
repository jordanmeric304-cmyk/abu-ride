import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const API_URL = 'https://abu-ride.onrender.com';

type Trip = {
  id: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  destination_name: string;
  fare: number;
};

const colors = {
  primary: '#176B45',
  primaryDark: '#0E5134',
  lightGreen: '#E8F5EE',
  lighterGreen: '#F3FAF6',
  background: '#F6F9F7',
  white: '#FFFFFF',
  text: '#17211B',
  muted: '#6B746D',
  border: '#DDE8E1',
  success: '#18794E',
  successBg: '#E4F4EB',
  activeBg: '#FFF4D8',
  activeText: '#8A620E',
};

export default function DriverHistoryScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);

      const token = await SecureStore.getItemAsync('auth_token');

      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await fetch(`${API_URL}/api/driver/trips`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert(
          'Unable to Load History',
          data.message || 'Unable to load trip history.'
        );
        return;
      }

      // Safely format trips and prevent NaN numerical bugs
      const formattedTrips: Trip[] = (data.trips || []).map((trip: any) => ({
        id: trip.id,
        status: trip.status || 'active',
        started_at: trip.started_at || null,
        completed_at: trip.completed_at || null,
        created_at: trip.created_at,
        destination_name: trip.destination_name || trip.destination || 'Campus Trip',
        fare: Number(trip.fare) || Number(trip.amount) || 0,
      }));

      setTrips(formattedTrips);
    } catch (error) {
      console.log('Driver history error:', error);

      Alert.alert(
        'Connection Error',
        'Unable to connect to the ABU Ride server.'
      );
    } finally {
      setLoading(false);
    }
  };

  const completedTrips = trips.filter(
    (trip) => trip.status === 'completed'
  ).length;

  const activeTrips = trips.filter(
    (trip) => trip.status === 'active'
  ).length;

  const totalFare = trips.reduce(
    (total, trip) => total + (Number(trip.fare) || 0),
    0
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}

      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.title}>
          Trip History
        </Text>

        <Pressable
          style={styles.refreshButton}
          onPress={loadHistory}
        >
          <Text style={styles.refreshText}>
            Refresh
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text style={styles.loadingText}>
            Loading trip history...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* SUMMARY */}

          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.summaryTitle}>
                  Your Trips
                </Text>
              </View>

              <View style={styles.summaryIcon}>
                <Text style={styles.summaryIconText}>
                  ✓
                </Text>
              </View>
            </View>

            <View style={styles.summaryStats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {trips.length}
                </Text>

                <Text style={styles.statLabel}>
                  Total
                </Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {completedTrips}
                </Text>

                <Text style={styles.statLabel}>
                  Completed
                </Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {activeTrips}
                </Text>

                <Text style={styles.statLabel}>
                  Active
                </Text>
              </View>
            </View>
          </View>

          {/* EARNINGS SUMMARY */}

          {trips.length > 0 && (
            <View style={styles.earningsCard}>
              <View style={styles.earningsIcon}>
                <Text style={styles.earningsIconText}>
                  ₦
                </Text>
              </View>

              <View style={styles.earningsInfo}>
                <Text style={styles.earningsLabel}>
                  Total Fare Value
                </Text>

                <Text style={styles.earningsAmount}>
                  ₦{totalFare.toLocaleString()}
                </Text>
              </View>
            </View>
          )}

          {/* TRIPS */}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Recent Trips
            </Text>

            {trips.length > 0 && (
              <Text style={styles.tripCount}>
                {trips.length}{' '}
                {trips.length === 1
                  ? 'trip'
                  : 'trips'}
              </Text>
            )}
          </View>

          {trips.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>
                  —
                </Text>
              </View>

              <Text style={styles.emptyTitle}>
                No trips yet
              </Text>

              <Text style={styles.emptyText}>
                Completed and active passenger
                trips will appear here after
                tickets are validated.
              </Text>

              <Pressable
                style={styles.emptyButton}
                onPress={() => router.back()}
              >
                <Text style={styles.emptyButtonText}>
                  Back to Dashboard
                </Text>
              </Pressable>
            </View>
          ) : (
            trips.map((trip) => {
              const isCompleted =
                trip.status === 'completed';

              const isActive =
                trip.status === 'active';

              return (
                <View
                  key={trip.id}
                  style={styles.tripCard}
                >
                  <View style={styles.tripTop}>
                    
                    <View
                      style={styles.destinationInfo}
                    >
                      <Text
                        style={styles.destination}
                        numberOfLines={2}
                      >
                        {trip.destination_name}
                      </Text>

                      <Text style={styles.tripNumber}>
                        Trip #{trip.id}
                      </Text>
                    </View>

                    <Text style={styles.fare}>
                      ₦
                      {(Number(trip.fare) || 0).toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.tripBottom}>
                    <Text style={styles.statusLabel}>
                      Status
                    </Text>

                    <View
                      style={[
                        styles.statusBadge,
                        isCompleted &&
                          styles.completedBadge,
                        isActive &&
                          styles.activeBadge,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          isCompleted &&
                            styles.completedDot,
                          isActive &&
                            styles.activeDot,
                        ]}
                      />

                      <Text
                        style={[
                          styles.statusText,
                          isCompleted &&
                            styles.completedText,
                          isActive &&
                            styles.activeText,
                        ]}
                      >
                        {trip.status
                          .charAt(0)
                          .toUpperCase() +
                          trip.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* HEADER */

  header: {
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 17,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },

  backText: {
    fontSize: 30,
    color: colors.primaryDark,
    marginTop: -3,
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },

  refreshButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  refreshText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 12,
  },

  /* CONTENT */

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  /* SUMMARY */

  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 19,
    marginBottom: 14,
  },

  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  summaryTitle: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '800',
  },

  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  summaryIconText: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '900',
  },

  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },

  stat: {
    flex: 1,
    alignItems: 'center',
  },

  statValue: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
  },

  statLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    marginTop: 3,
  },

  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  /* FARE SUMMARY */

  earningsCard: {
    backgroundColor: colors.white,
    borderRadius: 17,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },

  earningsIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },

  earningsIconText: {
    color: colors.primary,
    fontSize: 19,
    fontWeight: '900',
  },

  earningsInfo: {
    marginLeft: 13,
  },

  earningsLabel: {
    color: colors.muted,
    fontSize: 12,
  },

  earningsAmount: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 3,
  },

  /* SECTION */

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },

  tripCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },

  /* TRIP CARD */

  tripCard: {
    backgroundColor: colors.white,
    borderRadius: 17,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  tripTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  destinationInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },

  destination: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },

  tripNumber: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },

  fare: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.primary,
  },

  divider: {
    height: 1,
    backgroundColor: '#EDF1EE',
    marginVertical: 14,
  },

  tripBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  statusLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: colors.lightGreen,
  },

  completedBadge: {
    backgroundColor: colors.successBg,
  },

  activeBadge: {
    backgroundColor: colors.activeBg,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 6,
  },

  completedDot: {
    backgroundColor: colors.success,
  },

  activeDot: {
    backgroundColor: colors.activeText,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },

  completedText: {
    color: colors.success,
  },

  activeText: {
    color: colors.activeText,
  },

  /* EMPTY */

  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 19,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  emptyIconText: {
    color: colors.primary,
    fontSize: 25,
    fontWeight: '900',
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },

  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    lineHeight: 20,
    fontSize: 13,
  },

  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },

  emptyButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
  },

  /* LOADING */

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  loadingText: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 13,
  },
});