import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const API_URL = 'https://abu-ride.onrender.com';

type DriverProfile = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  driver_license_number: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  is_available: boolean;
  total_trips: number;
  total_earnings: number;
};

export default function DriverProfileScreen() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const token = await SecureStore.getItemAsync('auth_token');

      if (!token) {
        Alert.alert(
          'Session expired',
          'Please log in again.'
        );

        router.replace('/login');
        return;
      }

      const response = await fetch(
        `${API_URL}/api/driver/profile`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      console.log('Driver profile response:', data);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || 'Failed to load driver profile.'
        );
      }

      // IMPORTANT:
      // The backend returns the driver as data.driver
      setProfile(data.driver);
    } catch (error: any) {
      console.error('Driver profile error:', error);

      Alert.alert(
        'Unable to load profile',
        error.message ||
          'Something went wrong while loading your profile.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (!profile?.full_name) {
      return 'D';
    }

    const names = profile.full_name
      .trim()
      .split(' ')
      .filter(Boolean);

    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }

    return (
      names[0].charAt(0) +
      names[names.length - 1].charAt(0)
    ).toUpperCase();
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync(
                'auth_token'
              );

              await SecureStore.deleteItemAsync(
                'user'
              );

              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#168447"
        />

        <Text style={styles.loadingText}>
          Loading profile...
        </Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>
          Profile unavailable
        </Text>

        <Text style={styles.errorText}>
          We could not load your driver information.
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadProfile}
          activeOpacity={0.85}
        >
          <Text style={styles.retryButtonText}>
            Try Again
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.backButtonText}>
            Go Back
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              Driver Profile
            </Text>

          </View>
        </View>

        {/* PROFILE CARD */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials()}
            </Text>
          </View>

          <Text style={styles.driverName}>
            {profile.full_name}
          </Text>

          <View style={styles.roleBadge}>
            <View style={styles.roleDot} />

            <Text style={styles.roleText}>
              Driver
            </Text>
          </View>

          <View
            style={[
              styles.availabilityBadge,
              profile.is_available
                ? styles.availableBadge
                : styles.unavailableBadge,
            ]}
          >
            <Text
              style={[
                styles.availabilityText,
                profile.is_available
                  ? styles.availableText
                  : styles.unavailableText,
              ]}
            >
              {profile.is_available
                ? 'Available'
                : 'Unavailable'}
            </Text>
          </View>
        </View>

        {/* PERSONAL INFORMATION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Personal Information
          </Text>

          <View style={styles.infoCard}>
            <InfoRow
              label="Full Name"
              value={profile.full_name}
            />

            <InfoRow
              label="Email"
              value={profile.email}
            />

            <InfoRow
              label="Phone Number"
              value={
                profile.phone || 'Not provided'
              }
              isLast
            />
          </View>
        </View>
   
        {/* LOGOUT */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Text style={styles.logoutButtonText}>
            Log Out
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !isLast && styles.infoRowBorder,
      ]}
    >
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8F7',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#F6F8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    color: '#68736D',
    fontSize: 14,
  },

  errorTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#17201B',
    marginBottom: 8,
  },

  errorText: {
    fontSize: 14,
    color: '#68736D',
    textAlign: 'center',
    marginBottom: 22,
  },

  retryButton: {
    backgroundColor: '#168447',
    paddingHorizontal: 30,
    paddingVertical: 13,
    borderRadius: 12,
    marginBottom: 12,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  backButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
  },

  backButtonText: {
    color: '#168447',
    fontSize: 15,
    fontWeight: '700',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  backIconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E9E4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  backIcon: {
    fontSize: 31,
    lineHeight: 32,
    color: '#168447',
    marginTop: -3,
  },

  headerTitleContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#17201B',
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#758078',
  },

  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E1E9E3',
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#E4F3EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
    borderWidth: 2,
    borderColor: '#BFE3CB',
  },

  avatarText: {
    color: '#168447',
    fontSize: 28,
    fontWeight: '800',
  },

  driverName: {
    fontSize: 21,
    fontWeight: '800',
    color: '#17201B',
    textAlign: 'center',
    marginBottom: 9,
  },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 9,
  },

  roleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#168447',
    marginRight: 7,
  },

  roleText: {
    color: '#168447',
    fontSize: 12,
    fontWeight: '700',
  },

  availabilityBadge: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
  },

  availableBadge: {
    backgroundColor: '#E8F7ED',
  },

  unavailableBadge: {
    backgroundColor: '#F1F3F2',
  },

  availabilityText: {
    fontSize: 12,
    fontWeight: '700',
  },

  availableText: {
    color: '#168447',
  },

  unavailableText: {
    color: '#68736D',
  },

  section: {
    marginBottom: 22,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#17201B',
    marginBottom: 10,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1E9E3',
    overflow: 'hidden',
  },

  infoRow: {
    paddingHorizontal: 17,
    paddingVertical: 15,
  },

  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1EE',
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7A847E',
    marginBottom: 5,
  },

  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#17201B',
  },

  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1E9E3',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E5F5EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  statusIconText: {
    color: '#168447',
    fontSize: 20,
    fontWeight: '800',
  },

  statusContent: {
    flex: 1,
  },

  statusTitle: {
    color: '#17201B',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },

  statusDescription: {
    color: '#748078',
    fontSize: 12,
    lineHeight: 18,
  },

  logoutButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E3DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  logoutButtonText: {
    color: '#168447',
    fontSize: 15,
    fontWeight: '800',
  },

  bottomSpace: {
    height: 20,
  },
});