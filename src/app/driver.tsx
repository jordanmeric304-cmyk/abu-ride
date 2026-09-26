import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import abuLogo from '../../assets/images/abu-logo.png';

const API_URL = 'http://192.168.204.133:5000';

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
  updated_at: string;
};

type Destination = {
  id: number;
  name: string;
  description: string | null;
  fare: number;
  estimated_minutes: number | null;
};

export default function DriverDashboard() {
  const [driver, setDriver] =
    useState<DriverProfile | null>(null);

  const [destinations, setDestinations] =
    useState<Destination[]>([]);

  const [selectedDestination, setSelectedDestination] =
    useState<Destination | null>(null);

  const [isAvailable, setIsAvailable] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [updatingAvailability, setUpdatingAvailability] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const getToken = async () => {
    return await SecureStore.getItemAsync('auth_token');
  };

  const loadDriverData = async () => {
    try {
      const token = await getToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      const [
        profileResponse,
        destinationsResponse,
        availabilityResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/api/driver/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        fetch(`${API_URL}/api/destinations`),

        fetch(`${API_URL}/api/driver/availability`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const profileData =
        await profileResponse.json();

      const destinationsData =
        await destinationsResponse.json();

      const availabilityData =
        await availabilityResponse.json();

      if (!profileResponse.ok) {
        throw new Error(
          profileData.message ||
            'Unable to load driver profile'
        );
      }

      if (!destinationsResponse.ok) {
        throw new Error(
          destinationsData.message ||
            'Unable to load destinations'
        );
      }

      if (!availabilityResponse.ok) {
        throw new Error(
          availabilityData.message ||
            'Unable to load availability'
        );
      }

      const destinationList: Destination[] =
        destinationsData.destinations || [];

      setDriver(profileData.driver);

      setDestinations(destinationList);

      const availability =
        availabilityData.availability;

      const currentlyAvailable =
        Boolean(
          availability?.is_available
        );

      setIsAvailable(
        currentlyAvailable
      );

      if (availability?.location_id) {
        const currentDestination =
          destinationList.find(
            (destination) =>
              Number(destination.id) ===
              Number(
                availability.location_id
              )
          );

        setSelectedDestination(
          currentDestination || null
        );
      } else {
        setSelectedDestination(null);
      }
    } catch (error: any) {
      console.error(
        'Driver dashboard error:',
        error
      );

      Alert.alert(
        'Unable to load dashboard',
        error.message ||
          'Something went wrong'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDriverData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDriverData();
  };

  const chooseDestination = (
    destination: Destination
  ) => {
    if (isAvailable) {
      Alert.alert(
        'Go unavailable first',
        'Set yourself as unavailable before changing your route.'
      );

      return;
    }

    setSelectedDestination(
      destination
    );
  };

  const handleAvailability = async () => {
    if (
      !isAvailable &&
      !selectedDestination
    ) {
      Alert.alert(
        'Select a destination',
        'Please select the destination you are currently serving before becoming available.'
      );

      return;
    }

    try {
      setUpdatingAvailability(true);

      const token = await getToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await fetch(
        `${API_URL}/api/driver/availability`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            destination_id:
              selectedDestination?.id ||
              null,

            is_available:
              !isAvailable,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Unable to update availability'
        );
      }

      const newAvailability =
        Boolean(
          data.availability
            ?.is_available
        );

      setIsAvailable(
        newAvailability
      );

      if (
        data.availability
          ?.location_id
      ) {
        const destination =
          destinations.find(
            (item) =>
              Number(item.id) ===
              Number(
                data.availability
                  .location_id
              )
          );

        setSelectedDestination(
          destination || null
        );
      }

      Alert.alert(
        newAvailability
          ? 'You are now available'
          : 'You are now unavailable',
        data.message ||
          'Your availability has been updated.'
      );

      await loadDriverData();
    } catch (error: any) {
      console.error(
        'Availability update error:',
        error
      );

      Alert.alert(
        'Update failed',
        error.message ||
          'Something went wrong while updating availability.'
      );
    } finally {
      setUpdatingAvailability(
        false
      );
    }
  };

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <Image
          source={abuLogo}
          style={styles.loadingLogo}
          resizeMode="contain"
        />

        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text
          style={styles.loadingText}
        >
          Loading driver dashboard...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={
              COLORS.primary
            }
          />
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View
            style={
              styles.brandSection
            }
          >
            <Image
              source={abuLogo}
              style={styles.logo}
              resizeMode="contain"
            />

            <View
              style={
                styles.headerTextContainer
              }
            >
              <Text
                style={styles.appName}
              >
                ABU Ride
              </Text>

              <Text
                style={styles.title}
              >
                Driver Dashboard
              </Text>

              <Text
                style={styles.welcomeText}
              >
                Welcome back,{' '}
                {driver?.full_name ||
                  'Driver'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={
              styles.profileButton
            }
            activeOpacity={0.75}
            onPress={() =>
              router.push(
                '/driver-profile'
              )
            }
          >
            <Ionicons
              name="person-outline"
              size={21}
              color={
                COLORS.primary
              }
            />
          </TouchableOpacity>
        </View>


        {/* DRIVER SUMMARY */}
        <View
          style={styles.summaryCard}
        >
          <View
            style={
              styles.summaryHeader
            }
          >
            <Text
              style={
                styles.summaryTitle
              }
            >
              Driver Summary
            </Text>

            <Ionicons
              name="analytics-outline"
              size={22}
              color={
                COLORS.white
              }
            />
          </View>

          <View
            style={
              styles.summaryRow
            }
          >
            <View
              style={
                styles.summaryItem
              }
            >
              <Text
                style={
                  styles.summaryValue
                }
              >
                {driver?.total_trips ??
                  0}
              </Text>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                Total Trips
              </Text>
            </View>

            <View
              style={
                styles.summaryDivider
              }
            />

            <View
              style={
                styles.summaryItem
              }
            >
              <Text
                style={
                  styles.summaryValue
                }
              >
                ₦
                {Number(
                  driver?.total_earnings ||
                    0
                ).toLocaleString()}
              </Text>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                Total Earnings
              </Text>
            </View>
          </View>
        </View>

        {/* STATUS */}
        <View
          style={
            styles.availabilityCard
          }
        >
          <View
            style={
              styles.availabilityTop
            }
          >
            <View
              style={
                styles.statusIcon
              }
            >
              <Ionicons
                name={
                  isAvailable
                    ? 'radio'
                    : 'radio-outline'
                }
                size={24}
                color={
                  isAvailable
                    ? COLORS.success
                    : COLORS.muted
                }
              />
            </View>

            <View
              style={
                styles.availabilityText
              }
            >
              <Text
                style={
                  styles.cardLabel
                }
              >
                DRIVER STATUS
              </Text>

              <Text
                style={[
                  styles.statusTitle,
                  {
                    color: isAvailable
                      ? COLORS.success
                      : COLORS.darkText,
                  },
                ]}
              >
                {isAvailable
                  ? 'Available'
                  : 'Unavailable'}
              </Text>

              <Text
                style={
                  styles.statusDescription
                }
              >
                {isAvailable
                  ? ` `
                  : 'Select your route below, then become available when you are ready.'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.availabilityButton,
              isAvailable &&
                styles.availabilityButtonActive,
            ]}
            activeOpacity={0.8}
            onPress={
              handleAvailability
            }
            disabled={
              updatingAvailability
            }
          >
            {updatingAvailability ? (
              <ActivityIndicator
                color={
                  isAvailable
                    ? COLORS.primary
                    : COLORS.white
                }
              />
            ) : (
              <>
                <Ionicons
                  name={
                    isAvailable
                      ? 'pause-circle-outline'
                      : 'play-circle-outline'
                  }
                  size={20}
                  color={
                    isAvailable
                      ? COLORS.primary
                      : COLORS.white
                  }
                />

                <Text
                  style={[
                    styles.availabilityButtonText,
                    isAvailable &&
                      styles.availabilityButtonTextActive,
                  ]}
                >
                  {isAvailable
                    ? 'Set as Unavailable'
                    : 'Set as Available'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ROUTE SELECTION */}
        <View
          style={
            styles.routeSectionHeader
          }
        >
          <View
            style={
              styles.routeHeadingRow
            }
          >
            <View
              style={
                styles.routeHeadingIcon
              }
            >
              <Ionicons
                name="navigate"
                size={20}
                color={
                  COLORS.primary
                }
              />
            </View>

            <View
              style={
                styles.routeHeadingText
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Choose Your Route
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                {isAvailable
                  ? 'Set yourself as unavailable to change your route.'
                  : 'Swipe left or right and tap a destination.'}
              </Text>
            </View>
          </View>
        </View>

        {/* SELECTED ROUTE */}
        <View
          style={[
            styles.selectedRouteCard,
            selectedDestination &&
              styles.selectedRouteCardActive,
          ]}
        >
          {selectedDestination ? (
            <>
              <View
                style={
                  styles.selectedRouteIcon
                }
              >
                <Ionicons
                  name="location"
                  size={23}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <View
                style={
                  styles.selectedRouteDetails
                }
              >
                <Text
                  style={
                    styles.selectedLabel
                  }
                >
                  SELECTED ROUTE
                </Text>

                <Text
                  style={
                    styles.selectedDestination
                  }
                >
                  {
                    selectedDestination.name
                  }
                </Text>

                <Text
                  style={
                    styles.fareText
                  }
                >
                  ₦
                  {Number(
                    selectedDestination.fare
                  ).toLocaleString()}
                </Text>
              </View>

              <Ionicons
                name="checkmark-circle"
                size={27}
                color={
                  COLORS.success
                }
              />
            </>
          ) : (
            <>
              <View
                style={
                  styles.emptyRouteIcon
                }
              >
                <Ionicons
                  name="map-outline"
                  size={25}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <View
                style={
                  styles.noRouteText
                }
              >
                <Text
                  style={
                    styles.noRouteTitle
                  }
                >
                  No route selected
                </Text>

                <Text
                  style={
                    styles.noRouteDescription
                  }
                >
                  Choose a destination
                  below.
                </Text>
              </View>
            </>
          )}
        </View>

        {/* DESTINATIONS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.destinationScrollContent
          }
        >
          {destinations.map(
            (destination) => {
              const selected =
                Number(
                  selectedDestination?.id
                ) ===
                Number(
                  destination.id
                );

              return (
                <TouchableOpacity
                  key={
                    destination.id
                  }
                  activeOpacity={0.8}
                  onPress={() =>
                    chooseDestination(
                      destination
                    )
                  }
                  style={[
                    styles.destinationCard,
                    selected &&
                      styles.destinationCardSelected,
                    isAvailable &&
                      styles.destinationCardDisabled,
                  ]}
                >
                  <View
                    style={[
                      styles.destinationIcon,
                      selected &&
                        styles.destinationIconSelected,
                    ]}
                  >
                    <Ionicons
                      name={
                        selected
                          ? 'checkmark'
                          : 'navigate-outline'
                      }
                      size={22}
                      color={
                        selected
                          ? COLORS.white
                          : COLORS.primary
                      }
                    />
                  </View>

                  <Text
                    style={[
                      styles.destinationName,
                      selected &&
                        styles.destinationNameSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {
                      destination.name
                    }
                  </Text>

                  <View
                    style={
                      styles.destinationBottom
                    }
                  >
                    <Text
                      style={[
                        styles.destinationFareAmount,
                        selected &&
                          styles.destinationFareSelected,
                      ]}
                    >
                      ₦
                      {Number(
                        destination.fare
                      ).toLocaleString()}
                    </Text>

                    <Ionicons
                      name={
                        selected
                          ? 'checkmark-circle'
                          : 'chevron-forward-circle-outline'
                      }
                      size={20}
                      color={
                        selected
                          ? COLORS.success
                          : COLORS.muted
                      }
                    />
                  </View>
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>

        {/* DRIVER TOOLS */}
        
        <TouchableOpacity
          style={
            styles.driverToolsButton
          }
          activeOpacity={0.75}
          onPress={() =>
            router.push('/driver-tools')
          }
        >
          <View
            style={
              styles.driverToolsIcon
            }
          >
            <Ionicons
              name="grid-outline"
              size={25}
              color={
                COLORS.primary
              }
            />
          </View>

          <View
            style={
              styles.driverToolsText
            }
          >
            <Text
              style={
                styles.driverToolsTitle
              }
            >
              Open Driver Tools
            </Text>

            <Text
              style={
                styles.driverToolsDescription
              }
            >
              Ticket validation, trip history, earnings and profile
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={22}
            color={
              COLORS.muted
            }
          />
        </TouchableOpacity>

        <Text
          style={
            styles.footerText
          }
        >
          ABU Ride • Driver Service
        </Text>
      </ScrollView>
    </View>
  );
}

const COLORS = {
  primary: '#176B45',
  primaryDark: '#0E5134',
  lightGreen: '#E8F5EE',
  lighterGreen: '#F3FAF6',
  background: '#F6F9F7',
  white: '#FFFFFF',
  darkText: '#17211B',
  bodyText: '#5F6B63',
  muted: '#8C9891',
  border: '#E1E9E4',
  success: '#218A5B',
  secondaryBlue: '#3977B8',
  lightBlue: '#EEF5FC',
  gold: '#B98219',
  lightGold: '#FFF7E6',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 35,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor:
      COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingLogo: {
    width: 58,
    height: 58,
    marginBottom: 16,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.bodyText,
    fontSize: 14,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    marginBottom: 24,
  },

  brandSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },

  logo: {
    width: 52,
    height: 52,
    marginRight: 11,
  },

  headerTextContainer: {
    flex: 1,
  },

  appName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.2,
    marginBottom: 2,
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.darkText,
    letterSpacing: -0.5,
  },

  welcomeText: {
    marginTop: 5,
    fontSize: 13,
    color: COLORS.bodyText,
  },

  profileButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor:
      COLORS.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D6EBDD',
  },

  availabilityCard: {
    backgroundColor:
      COLORS.white,
    borderRadius: 22,
    padding: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 29,
    shadowColor: '#163A28',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 2,
  },

  availabilityTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor:
      COLORS.lighterGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  availabilityText: {
    flex: 1,
  },

  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.7,
  },

  statusTitle: {
    fontSize: 21,
    fontWeight: '800',
    marginTop: 2,
  },

  statusDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.bodyText,
    marginTop: 4,
  },

  availabilityButton: {
    marginTop: 18,
    height: 49,
    borderRadius: 14,
    backgroundColor:
      COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  availabilityButtonActive: {
    backgroundColor:
      COLORS.lightGreen,
    borderWidth: 1,
    borderColor: '#CDE4D6',
  },

  availabilityButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },

  availabilityButtonTextActive: {
    color: COLORS.primary,
  },

  routeSectionHeader: {
    marginBottom: 13,
  },

  routeHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  routeHeadingIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor:
      COLORS.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  routeHeadingText: {
    flex: 1,
  },

  selectedRouteCard: {
    minHeight: 82,
    backgroundColor:
      COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },

  selectedRouteCardActive: {
    backgroundColor:
      COLORS.lighterGreen,
    borderColor: '#BFDCCA',
  },

  selectedRouteIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor:
      COLORS.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  selectedRouteDetails: {
    flex: 1,
  },

  selectedLabel: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  selectedDestination: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.darkText,
    marginTop: 2,
    marginBottom: 4,
  },

  fareText: {
    fontSize: 13,
    color: COLORS.gold,
    fontWeight: '800',
  },

  emptyRouteIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor:
      COLORS.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  noRouteText: {
    flex: 1,
  },

  noRouteTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.darkText,
  },

  noRouteDescription: {
    fontSize: 12,
    color: COLORS.bodyText,
    marginTop: 3,
  },

  destinationScrollContent: {
    paddingRight: 20,
    paddingBottom: 4,
    marginBottom: 28,
  },

  destinationCard: {
    width: 155,
    minHeight: 145,
    backgroundColor:
      COLORS.white,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginRight: 11,
    justifyContent:
      'space-between',
  },

  destinationCardSelected: {
    backgroundColor:
      COLORS.lighterGreen,
    borderColor: '#9CC8AE',
    borderWidth: 1.5,
  },

  destinationCardDisabled: {
    opacity: 0.65,
  },

  destinationIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor:
      COLORS.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },

  destinationIconSelected: {
    backgroundColor:
      COLORS.primary,
  },

  destinationName: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    color: COLORS.darkText,
    marginTop: 11,
    minHeight: 38,
  },

  destinationNameSelected: {
    color: COLORS.primaryDark,
  },

  destinationBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    marginTop: 8,
  },

  destinationFareAmount: {
    fontSize: 13,
    color: COLORS.gold,
    fontWeight: '800',
  },

  destinationFareSelected: {
    color: COLORS.primary,
  },

  sectionHeader: {
    marginBottom: 13,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.darkText,
  },

  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.bodyText,
    marginTop: 3,
    lineHeight: 18,
  },

  driverToolsButton: {
    backgroundColor:
      COLORS.white,
    minHeight: 86,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },

  driverToolsIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor:
      COLORS.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  driverToolsText: {
    flex: 1,
    paddingRight: 8,
  },

  driverToolsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.darkText,
  },

  driverToolsDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.bodyText,
    marginTop: 3,
  },

  summaryCard: {
    backgroundColor:
      COLORS.primaryDark,
    borderRadius: 22,
    padding: 19,
    marginBottom: 22,
  },

  summaryHeader: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  summaryTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  summaryItem: {
    flex: 1,
  },

  summaryValue: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
  },

  summaryLabel: {
    color: '#C9DDD2',
    fontSize: 11,
    marginTop: 4,
  },

  summaryDivider: {
    width: 1,
    height: 42,
    backgroundColor:
      '#4C7964',
    marginHorizontal: 15,
  },

  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
});