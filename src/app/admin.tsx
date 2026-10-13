import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import abuLogo from '../../assets/images/abu-logo.png';

export default function AdminScreen() {
  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync('auth_token');
              await SecureStore.deleteItemAsync('user');
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Image source={abuLogo} style={styles.logo} resizeMode="contain" />
          <View style={styles.headerText}>
            <Text style={styles.logoTitle}>ABU RIDE</Text>
            <Text style={styles.logoSubtitle}>Administrator</Text>
          </View>
        </View>

        {/* WELCOME */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeIcon}>
            <Text style={styles.welcomeIconText}>A</Text>
          </View>
          <View style={styles.welcomeContent}>
            <Text style={styles.welcomeTitle}>Admin Dashboard</Text>
          </View>
        </View>

        {/* MANAGEMENT */}
        <Text style={styles.sectionTitle}>Management</Text>

        {/* MANAGE USERS */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/admin-users')}
          activeOpacity={0.85}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>👤</Text>
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Manage Users</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {/* REPORTS & COMPLAINTS */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/admin-reports')}
          activeOpacity={0.85}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>⚠️</Text>
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Reports & Complaints</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

   
        {/* DRIVER EARNINGS */}
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/admin-driver-earnings')}
          activeOpacity={0.85}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>₦</Text>
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Driver Earnings</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {/* LOGOUT */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Text style={styles.logoutText}>LOG OUT</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8F7' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 35 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  logo: { width: 58, height: 58, marginRight: 11 },
  headerText: { flex: 1 },
  logoTitle: { fontSize: 21, fontWeight: '900', color: '#168447', letterSpacing: 0.6 },
  logoSubtitle: { fontSize: 11, color: '#758078', marginTop: 2 },
  welcomeCard: {
    backgroundColor: '#168447',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  welcomeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  welcomeIconText: { color: '#168447', fontSize: 22, fontWeight: '900' },
  welcomeContent: { flex: 1 },
  welcomeTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#17201B', marginBottom: 12 },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE8DF',
    padding: 17,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E5F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  iconText: { color: '#168447', fontSize: 21, fontWeight: '900' },
  menuContent: { flex: 1, paddingRight: 8 },
  menuTitle: { fontSize: 16, fontWeight: '800', color: '#17201B' },
  menuSubtitle: { fontSize: 12, color: '#758078', lineHeight: 18, marginTop: 4 },
  arrow: { color: '#168447', fontSize: 30, marginLeft: 'auto', marginTop: -3 },
  logoutButton: {
    height: 50,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E3D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  logoutText: { color: '#168447', fontSize: 12, fontWeight: '800' },
  bottomSpace: { height: 20 },
});