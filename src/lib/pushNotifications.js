import { supabase } from "../supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export async function registerPushNotifications() {
  if (!("serviceWorker" in navigator)) throw new Error("This browser does not support service workers.");
  if (!("PushManager" in window)) throw new Error("This browser does not support push notifications.");
  if (!("Notification" in window)) throw new Error("This browser does not support notifications.");
  if (!VAPID_PUBLIC_KEY) throw new Error("Missing VITE_VAPID_PUBLIC_KEY.");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("You must be signed in to enable notifications.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subscriptionJson = subscription.toJSON();
  const endpoint = subscriptionJson.endpoint;
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) throw new Error("Browser returned an incomplete push subscription.");

  const { data: existing, error: lookupError } = await supabase
    .from("milestone_push_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const payload = { user_id: user.id, endpoint, p256dh, auth };
  const result = existing?.id
    ? await supabase.from("milestone_push_subscriptions").update(payload).eq("id", existing.id)
    : await supabase.from("milestone_push_subscriptions").insert(payload);

  if (result.error) throw result.error;

  return { success: true, subscription };
}

export async function enableMilestonePushNotifications() {
  return registerPushNotifications();
}

export async function disablePushNotifications() {
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const { error } = await supabase
    .from("milestone_push_subscriptions")
    .delete()
    .eq("endpoint", subscription.endpoint);

  if (error) throw error;
  await subscription.unsubscribe();
}
