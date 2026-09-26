import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function DriverToolsScreen() {
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>Driver Tools</Text>
          </View>
        </View>

        {/* SCAN TICKET */}
        <Pressable
          style={styles.scanCard}
          onPress={() => router.push('/scanner')}
        >
          <View style={styles.scanIconBox}>
            <Text style={styles.scanIcon}>▦</Text>
          </View>

          <View style={styles.scanContent}>
            <Text style={styles.scanTitle}>
              Scan Ticket
            </Text>

          </View>

          <Text style={styles.scanArrow}>›</Text>
        </Pressable>

        {/* TOOLS */}

        {/* TRIP HISTORY */}
        <Pressable
          style={styles.toolCard}
          onPress={() => router.push('/driver-history')}
        >
          <View style={styles.iconBox}>
            <Text style={styles.icon}>↗</Text>
          </View>

          <View style={styles.toolContent}>
            <Text style={styles.toolTitle}>
              Trip History
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        {/* EARNINGS */}
        <Pressable
          style={styles.toolCard}
          onPress={() => router.push('/driver-earnings')}
        >
          <View style={styles.iconBox}>
            <Text style={styles.icon}>₦</Text>
          </View>

          <View style={styles.toolContent}>
            <Text style={styles.toolTitle}>
              Earnings
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        {/* DRIVER PROFILE */}
        <Pressable
          style={styles.toolCard}
          onPress={() => router.push('/driver-profile')}
        >
          <View style={styles.iconBox}>
            <Text style={styles.icon}>●</Text>
          </View>

          <View style={styles.toolContent}>
            <Text style={styles.toolTitle}>
              Driver Profile
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
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
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F3EC',
    borderWidth: 1,
    borderColor: '#CFE1D5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  backText: {
    fontSize: 30,
    lineHeight: 32,
    color: '#176B45',
    fontWeight: '500',
    marginTop: -2,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#176B45',
  },

  subtitle: {
    fontSize: 13,
    color: '#6B756F',
    marginTop: 3,
  },

  /* SCAN TICKET */

  scanCard: {
    backgroundColor: '#176B45',
    borderRadius: 18,
    padding: 18,
    marginBottom: 27,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#176B45',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },

  scanIconBox: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  scanIcon: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '700',
  },

  scanContent: {
    flex: 1,
  },

  scanTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },

  scanDescription: {
    color: '#DCEFE5',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  scanArrow: {
    color: '#FFFFFF',
    fontSize: 30,
    marginLeft: 10,
  },

  /* SECTION */

  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#176B45',
    marginBottom: 13,
  },

  /* NORMAL TOOL CARDS */

  toolCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 17,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCE7E0',
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E8F3EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  icon: {
    color: '#176B45',
    fontSize: 20,
    fontWeight: '800',
  },

  toolContent: {
    flex: 1,
  },

  toolTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2933',
  },

  toolDescription: {
    fontSize: 12,
    color: '#6B756F',
    lineHeight: 18,
    marginTop: 4,
  },

  arrow: {
    fontSize: 28,
    color: '#176B45',
    marginLeft: 10,
  },

  /* INFORMATION */

  infoCard: {
    backgroundColor: '#176B45',
    borderRadius: 18,
    padding: 20,
    marginTop: 12,
  },

  infoTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 7,
  },

  infoText: {
    color: '#DCEFE5',
    fontSize: 13,
    lineHeight: 20,
  },
});