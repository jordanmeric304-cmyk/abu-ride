import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import abuLogo from '../../assets/images/abu-logo.png';

const API_URL = 'http://192.168.204.133:5000';

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] =
    useState<'passenger' | 'driver'>('passenger');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        'Missing information',
        'Please enter your email and password.'
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert(
          'Login failed',
          data.message || 'Unable to log in.'
        );
        return;
      }

      console.log('Logged in user:', data.user);

      await SecureStore.setItemAsync(
        'auth_token',
        data.token
      );

      await SecureStore.setItemAsync(
        'user',
        JSON.stringify(data.user)
      );

      console.log('JWT saved securely');

      if (data.user.role === 'admin') {
        router.replace('/admin');
      } else if (data.user.role === 'driver') {
        router.replace('/driver');
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.error('Login error:', error);

      Alert.alert(
        'Connection error',
        'Could not connect to the ABU Ride server.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (
      !fullName.trim() ||
      !email.trim() ||
      !password
    ) {
      Alert.alert(
        'Missing information',
        'Please enter your name, email and password.'
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Weak password',
        'Password must contain at least 6 characters.'
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || null,
            password,
            role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert(
          'Registration failed',
          data.message || 'Unable to create account.'
        );
        return;
      }

      Alert.alert(
        'Account Created',
        `Your ${role} account has been created successfully. You can now log in.`,
        [
          {
            text: 'Continue',
            onPress: () => {
              setMode('login');
              setPassword('');
            },
          },
        ]
      );
    } catch (error) {
      console.error(
        'Registration error:',
        error
      );

      Alert.alert(
        'Connection error',
        'Could not connect to the ABU Ride server.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>

          {/* BRANDING */}

          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <Image
                source={abuLogo}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.brandName}>
              ABU RIDE
            </Text>

            <Text style={styles.brandSubtitle}>
              QR-Code Based Bus Fare Ticketing
            </Text>
          </View>

          {/* TITLE */}



          {/* LOGIN / REGISTER TABS */}

          <View style={styles.tabs}>
            <Pressable
              style={[
                styles.tab,
                mode === 'login' &&
                  styles.activeTab,
              ]}
              onPress={() =>
                setMode('login')
              }
            >
              <Text
                style={[
                  styles.tabText,
                  mode === 'login' &&
                    styles.activeTabText,
                ]}
              >
                Login
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tab,
                mode === 'register' &&
                  styles.activeTab,
              ]}
              onPress={() =>
                setMode('register')
              }
            >
              <Text
                style={[
                  styles.tabText,
                  mode === 'register' &&
                    styles.activeTabText,
                ]}
              >
                Register
              </Text>
            </Pressable>
          </View>

          {/* FORM */}

          <View style={styles.form}>

            {mode === 'register' && (
              <>
                <Text style={styles.label}>
                  Full Name
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#8A938E"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />

                <Text style={styles.label}>
                  Phone Number
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Enter your phone number"
                  placeholderTextColor="#8A938E"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />

                <Text style={styles.label}>
                  Account Type
                </Text>

                <View
                  style={
                    styles.roleContainer
                  }
                >
                  <Pressable
                    style={[
                      styles.roleButton,
                      role === 'passenger' &&
                        styles.selectedRoleButton,
                    ]}
                    onPress={() =>
                      setRole('passenger')
                    }
                  >
                    <View
                      style={[
                        styles.roleIcon,
                        role === 'passenger' &&
                          styles.selectedRoleIcon,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleIconText,
                          role === 'passenger' &&
                            styles.selectedRoleIconText,
                        ]}
                      >
                        P
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.roleText,
                        role === 'passenger' &&
                          styles.selectedRoleText,
                      ]}
                    >
                      Passenger
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.roleButton,
                      role === 'driver' &&
                        styles.selectedRoleButton,
                    ]}
                    onPress={() =>
                      setRole('driver')
                    }
                  >
                    <View
                      style={[
                        styles.roleIcon,
                        role === 'driver' &&
                          styles.selectedRoleIcon,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleIconText,
                          role === 'driver' &&
                            styles.selectedRoleIconText,
                        ]}
                      >
                        D
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.roleText,
                        role === 'driver' &&
                          styles.selectedRoleText,
                      ]}
                    >
                      Driver
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            <Text style={styles.label}>
              Email
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#8A938E"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>
              Password
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#8A938E"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {/* MAIN BUTTON */}

            <Pressable
              style={[
                styles.loginButton,
                loading &&
                  styles.disabledButton,
              ]}
              onPress={
                mode === 'login'
                  ? handleLogin
                  : handleRegister
              }
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <Text
                  style={
                    styles.loginButtonText
                  }
                >
                  {mode === 'login'
                    ? 'Login'
                    : 'Create Account'}
                </Text>
              )}
            </Pressable>

            {/* BOTTOM SWITCH */}

            <View
              style={
                styles.switchContainer
              }
            >
              <Text
                style={
                  styles.switchText
                }
              >
                {mode === 'login'
                  ? "Don't have an account?"
                  : 'Already have an account?'}
              </Text>

              <Pressable
                onPress={() =>
                  setMode(
                    mode === 'login'
                      ? 'register'
                      : 'login'
                  )
                }
              >
                <Text
                  style={
                    styles.switchLink
                  }
                >
                  {mode === 'login'
                    ? ' Register'
                    : ' Login'}
                </Text>
              </Pressable>
            </View>

          </View>

          {/* FOOTER */}

          <Text style={styles.footer}>
            By: Muhammad Rilwan Abdullahi
            {'\n'} U23CS2041
            
          </Text>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8F7',
  },

  scrollContent: {
    flexGrow: 1,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 35,
  },

  /* BRANDING */

  brandSection: {
    alignItems: 'center',
    marginBottom: 24,
  },

  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCE8DF',
    marginBottom: 12,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  logo: {
    width: 68,
    height: 68,
  },

  brandName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#168447',
    letterSpacing: 1,
  },

  brandSubtitle: {
    fontSize: 11,
    color: '#758078',
    marginTop: 4,
    textAlign: 'center',
  },

  /* TITLE */

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#17201B',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: '#758078',
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 22,
    lineHeight: 20,
  },

  /* TABS */

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E9F1EC',
    borderRadius: 14,
    padding: 4,
    marginBottom: 19,
    borderWidth: 1,
    borderColor: '#DDE9E0',
  },

  tab: {
    flex: 1,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
  },

  activeTab: {
    backgroundColor: '#FFFFFF',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },

  tabText: {
    color: '#758078',
    fontSize: 14,
    fontWeight: '700',
  },

  activeTabText: {
    color: '#168447',
  },

  /* FORM */

  form: {
    width: '100%',
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#344039',
    marginBottom: 7,
    marginTop: 12,
  },

  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE8DF',
    borderRadius: 13,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#17201B',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },

  /* ACCOUNT TYPE */

  roleContainer: {
    flexDirection: 'row',
    gap: 10,
  },

  roleButton: {
    flex: 1,
    minHeight: 62,
    borderWidth: 1,
    borderColor: '#DCE8DF',
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  selectedRoleButton: {
    backgroundColor: '#168447',
    borderColor: '#168447',
  },

  roleIcon: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#E7F3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedRoleIcon: {
    backgroundColor: '#FFFFFF',
  },

  roleIconText: {
    color: '#168447',
    fontSize: 11,
    fontWeight: '900',
  },

  selectedRoleIconText: {
    color: '#168447',
  },

  roleText: {
    color: '#344039',
    fontSize: 13,
    fontWeight: '700',
  },

  selectedRoleText: {
    color: '#FFFFFF',
  },

  /* MAIN BUTTON */

  loginButton: {
    height: 54,
    backgroundColor: '#168447',
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,

    shadowColor: '#168447',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 3,
  },

  disabledButton: {
    opacity: 0.65,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  /* SWITCH */

  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },

  switchText: {
    color: '#758078',
    fontSize: 13,
  },

  switchLink: {
    color: '#168447',
    fontSize: 13,
    fontWeight: '800',
  },

  /* FOOTER */

  footer: {
    textAlign: 'center',
    color: '#9AA39E',
    fontSize: 11,
    marginTop: 28,
  },
});