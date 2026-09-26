import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// IMPORTANT: use the same LAN IP as the backend your phone is connecting to.
const API_URL = 'http://192.168.204.133:5000';

export default function ScannerScreen() {
  const [permission, requestPermission] =
    useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBarcodeScanned = async ({
    data,
  }: {
    data: string;
  }) => {
    if (scanned || loading) {
      return;
    }

    if (!data || !data.trim()) {
      return;
    }

    setScanned(true);
    setLoading(true);

    try {
      const token =
        await SecureStore.getItemAsync('auth_token');

      if (!token) {
        setLoading(false);

        Alert.alert(
          'Session Error',
          'Your driver session has expired. Please log in again.',
          [
            {
              text: 'Go to Login',
              onPress: () => router.replace('/login'),
            },
          ]
        );

        return;
      }

      console.log(
        'Scanned QR data:',
        data
      );

      const response = await fetch(
        `${API_URL}/api/tickets/validate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            qr_token: data.trim(),
          }),
        }
      );

      let result: any = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      console.log(
        'Ticket validation response:',
        response.status,
        result
      );

      if (!response.ok || !result?.success) {
        Alert.alert(
          'Invalid Ticket',
          result?.message ||
            'This ticket could not be validated.',
          [
            {
              text: 'Scan Again',
              onPress: () => {
                setScanned(false);
              },
            },
          ]
        );

        return;
      }

      const ticket = result.ticket || {};

      Alert.alert(
        'Payment Confirmed',
        `Passenger: ${
          ticket.passenger_name || 'Unknown'
        }\n\n` +
          `Destination: ${
            ticket.destination_name || 'Unknown'
          }\n\n` +
          `Fare: ₦${Number(
            ticket.amount || 0
          ).toLocaleString()}\n\n` +
          `Ticket: ${
            ticket.ticket_reference || 'N/A'
          }`,
        [
          {
            text: 'Scan Next',
            onPress: () => {
              setScanned(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error(
        'Ticket validation error:',
        error
      );

      Alert.alert(
        'Connection Error',
        'Could not connect to the ABU Ride server. Make sure the backend is running and your phone is connected to the same Wi-Fi network as the computer.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              setScanned(false);
            },
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------
  // CAMERA PERMISSION LOADING
  // ----------------------------------------------------------

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text style={styles.loadingPermissionText}>
          Preparing scanner...
        </Text>
      </View>
    );
  }

  // ----------------------------------------------------------
  // CAMERA PERMISSION NOT GRANTED
  // ----------------------------------------------------------

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <View style={styles.permissionIcon}>
          <Text style={styles.permissionIconText}>
            QR
          </Text>
        </View>

        <Text style={styles.permissionTitle}>
          Camera Permission Required
        </Text>

        <Text style={styles.permissionText}>
          ABU Ride needs access to the camera so
          drivers can scan and verify passenger
          QR tickets.
        </Text>

        <Pressable
          style={styles.button}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>
            Allow Camera
          </Text>
        </Pressable>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  // ----------------------------------------------------------
  // SCANNER
  // ----------------------------------------------------------

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={
          scanned
            ? undefined
            : handleBarcodeScanned
        }
      />

      <View style={styles.overlay}>
        {/* TOP BAR */}

        <View style={styles.topBar}>
          <Pressable
            style={styles.backCircle}
            onPress={() => router.back()}
          >
            <Text style={styles.backCircleText}>
              ‹
            </Text>
          </Pressable>

          <View style={styles.titleContainer}>
            <Text style={styles.topTitle}>
              Scan Ticket
            </Text>

            <Text style={styles.topSubtitle}>
              ABU Ride Driver
            </Text>
          </View>

          <View style={styles.placeholder} />
        </View>

        {/* SCAN FRAME */}

        <View style={styles.scanArea}>
          <View
            style={[
              styles.corner,
              styles.topLeft,
            ]}
          />

          <View
            style={[
              styles.corner,
              styles.topRight,
            ]}
          />

          <View
            style={[
              styles.corner,
              styles.bottomLeft,
            ]}
          />

          <View
            style={[
              styles.corner,
              styles.bottomRight,
            ]}
          />

          {loading && (
            <View style={styles.scanLoading}>
              <ActivityIndicator
                size="large"
                color="#fff"
              />
            </View>
          )}
        </View>

        {/* BOTTOM PANEL */}

        <View style={styles.instructions}>
          <View style={styles.handle} />

          <Text style={styles.instructionTitle}>
            {loading
              ? 'Verifying Ticket'
              : scanned
              ? 'Ticket Scanned'
              : 'Scan Passenger QR Code'}
          </Text>

          <Text style={styles.instructionText}>
            {loading
              ? 'Please wait while the ticket is verified.'
              : scanned
              ? 'Review the validation result before scanning another ticket.'
              : 'Place the passenger’s QR ticket inside the frame to verify their payment.'}
          </Text>

          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator
                color={colors.primary}
                size="small"
              />

              <Text style={styles.loadingText}>
                Verifying ticket...
              </Text>
            </View>
          )}

          {scanned && !loading && (
            <Pressable
              style={styles.rescanButton}
              onPress={() => setScanned(false)}
            >
              <Text style={styles.rescanButtonText}>
                Scan Again
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const colors = {
  primary: '#176B45',
  primaryDark: '#0E5134',
  lightGreen: '#E8F5EE',
  background: '#F6F9F7',
  white: '#FFFFFF',
  text: '#17211B',
  muted: '#6B746D',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },

  topBar: {
    height: 115,
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(14,81,52,0.82)',
  },

  backCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  backCircleText: {
    fontSize: 32,
    color: colors.text,
    marginTop: -4,
  },

  titleContainer: {
    alignItems: 'center',
  },

  topTitle: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '800',
  },

  topSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 3,
  },

  placeholder: {
    width: 42,
  },

  scanArea: {
    width: 270,
    height: 270,
    alignSelf: 'center',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },

  corner: {
    position: 'absolute',
    width: 55,
    height: 55,
    borderColor: '#fff',
  },

  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },

  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },

  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },

  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },

  scanLoading: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor:
      'rgba(23,107,69,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  instructions: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingHorizontal: 25,
    paddingTop: 12,
    paddingBottom: 35,
    alignItems: 'center',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },

  handle: {
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#C9D5CE',
    marginBottom: 18,
  },

  instructionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },

  instructionText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 330,
  },

  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },

  loadingText: {
    color: colors.primaryDark,
    marginLeft: 9,
    fontSize: 14,
    fontWeight: '700',
  },

  rescanButton: {
    marginTop: 17,
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 13,
    borderRadius: 11,
    minWidth: 150,
    alignItems: 'center',
  },

  rescanButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 30,
  },

  permissionIcon: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  permissionIconText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
  },

  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },

  permissionText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 25,
    maxWidth: 330,
  },

  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 11,
    minWidth: 170,
    alignItems: 'center',
  },

  buttonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },

  backButton: {
    marginTop: 15,
    padding: 12,
  },

  backText: {
    color: colors.primary,
    fontWeight: '700',
  },

  loadingPermissionText: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 12,
  },
});