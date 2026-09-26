import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type User = {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
};

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const savedUser =
        await SecureStore.getItemAsync('user');

      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.log('Load profile error:', error);
    }
  };

  const logout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync(
              'auth_token'
            );

            await SecureStore.deleteItemAsync(
              'user'
            );

            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
      >
        {/* BRAND */}
        <View style={styles.brand}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/images/abu-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.appName}>
            ABU Ride
          </Text>
        </View>

        {/* PROFILE HEADER */}
        <View style={styles.profileCard}>
          <View style={styles.profileImageWrapper}>
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitial}>
                {user?.full_name
                  ? user.full_name
                      .charAt(0)
                      .toUpperCase()
                  : 'P'}
              </Text>
            </View>
          </View>

          <Text style={styles.userName}>
            {user?.full_name || 'Passenger'}
          </Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              Passenger
            </Text>
          </View>
        </View>

        {/* LOGOUT */}
        <Pressable
          style={styles.logoutButton}
          onPress={logout}
        >
          <Text style={styles.logoutText}>
            Logout
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },

  scrollContent: {
    padding: 20,
    paddingTop: 30,
    paddingBottom: 50,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 35,
  },

  logoWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#DCE7E0',
    overflow: 'hidden',
  },

  logo: {
    width: 40,
    height: 40,
  },

  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#176B45',
  },

  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCE7E0',
  },

  profileImageWrapper: {
    marginBottom: 18,
  },

  profilePlaceholder: {
    width: 105,
    height: 105,
    borderRadius: 53,
    backgroundColor: '#E8F3EC',
    borderWidth: 3,
    borderColor: '#CDE2D5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileInitial: {
    fontSize: 40,
    fontWeight: '800',
    color: '#176B45',
  },

  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2933',
    textAlign: 'center',
    marginBottom: 10,
  },

  roleBadge: {
    backgroundColor: '#E8F3EC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },

  roleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#176B45',
  },

  logoutButton: {
    marginTop: 25,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0B8B8',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },

  logoutText: {
    color: '#B42318',
    fontSize: 15,
    fontWeight: '700',
  },
});