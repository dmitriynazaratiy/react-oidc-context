// src/AuthContext.ts
import React from "react";
var AuthContext = React.createContext(void 0);
AuthContext.displayName = "AuthContext";

// src/AuthProvider.tsx
import React2 from "react";
import { UserManager } from "oidc-client-ts";

// src/AuthState.ts
var initialAuthState = {
  isLoading: true,
  isAuthenticated: false
};

// src/reducer.ts
var reducer = (state, action) => {
  switch (action.type) {
    case "INITIALISED":
    case "USER_LOADED":
      return {
        ...state,
        user: action.user,
        isLoading: false,
        isAuthenticated: action.user ? !action.user.expired : false,
        error: void 0
      };
    case "USER_SIGNED_OUT":
    case "USER_UNLOADED":
      return {
        ...state,
        user: void 0,
        isAuthenticated: false
      };
    case "NAVIGATOR_INIT":
      return {
        ...state,
        isLoading: true,
        activeNavigator: action.method
      };
    case "NAVIGATOR_CLOSE":
      return {
        ...state,
        isLoading: false,
        activeNavigator: void 0
      };
    case "ERROR":
      return {
        ...state,
        isLoading: false,
        error: action.error
      };
    default:
      return {
        ...state,
        isLoading: false,
        error: new Error(`unknown type ${action["type"]}`)
      };
  }
};

// src/utils.ts
var hasAuthParams = (location = window.location) => {
  let searchParams = new URLSearchParams(location.search);
  if ((searchParams.get("code") || searchParams.get("error")) && searchParams.get("state")) {
    return true;
  }
  searchParams = new URLSearchParams(location.hash.replace("#", "?"));
  if ((searchParams.get("code") || searchParams.get("error")) && searchParams.get("state")) {
    return true;
  }
  return false;
};
var normalizeErrorFn = (fallbackMessage) => (error) => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(fallbackMessage);
};
var signinError = normalizeErrorFn("Sign-in failed");
var signoutError = normalizeErrorFn("Sign-out failed");

// src/AuthProvider.tsx
var userManagerContextKeys = [
  "clearStaleState",
  "querySessionStatus",
  "revokeTokens",
  "startSilentRenew",
  "stopSilentRenew"
];
var navigatorKeys = [
  "signinPopup",
  "signinSilent",
  "signinRedirect",
  "signinResourceOwnerCredentials",
  "signoutPopup",
  "signoutRedirect",
  "signoutSilent"
];
var unsupportedEnvironment = (fnName) => () => {
  throw new Error(
    `UserManager#${fnName} was called from an unsupported context. If this is a server-rendered page, defer this call with useEffect() or pass a custom UserManager implementation.`
  );
};
var UserManagerImpl = typeof window === "undefined" ? null : UserManager;
var AuthProvider = (props) => {
  const {
    children,
    onSigninCallback,
    skipSigninCallback,
    matchSignoutCallback,
    onSignoutCallback,
    onRemoveUser,
    userManager: userManagerProp = null,
    ...userManagerSettings
  } = props;
  const [userManager] = React2.useState(() => {
    return userManagerProp != null ? userManagerProp : UserManagerImpl ? new UserManagerImpl(userManagerSettings) : { settings: userManagerSettings };
  });
  const [state, dispatch] = React2.useReducer(reducer, initialAuthState);
  const userManagerContext = React2.useMemo(
    () => Object.assign(
      {
        settings: userManager.settings,
        events: userManager.events
      },
      Object.fromEntries(
        userManagerContextKeys.map((key) => {
          var _a, _b;
          return [
            key,
            (_b = (_a = userManager[key]) == null ? void 0 : _a.bind(userManager)) != null ? _b : unsupportedEnvironment(key)
          ];
        })
      ),
      Object.fromEntries(
        navigatorKeys.map((key) => [
          key,
          userManager[key] ? async (args) => {
            dispatch({
              type: "NAVIGATOR_INIT",
              method: key
            });
            try {
              return await userManager[key](args);
            } catch (error) {
              dispatch({ type: "ERROR", error });
              return null;
            } finally {
              dispatch({ type: "NAVIGATOR_CLOSE" });
            }
          } : unsupportedEnvironment(key)
        ])
      )
    ),
    [userManager]
  );
  const didInitialize = React2.useRef(false);
  React2.useEffect(() => {
    if (!userManager || didInitialize.current) {
      return;
    }
    didInitialize.current = true;
    void (async () => {
      try {
        let user = null;
        if (hasAuthParams() && !skipSigninCallback) {
          user = await userManager.signinCallback();
          if (onSigninCallback) await onSigninCallback(user);
        }
        user = !user ? await userManager.getUser() : user;
        dispatch({ type: "INITIALISED", user });
      } catch (error) {
        dispatch({ type: "ERROR", error: signinError(error) });
      }
      try {
        if (matchSignoutCallback && matchSignoutCallback(userManager.settings)) {
          const resp = await userManager.signoutCallback();
          if (onSignoutCallback) await onSignoutCallback(resp);
        }
      } catch (error) {
        dispatch({ type: "ERROR", error: signoutError(error) });
      }
    })();
  }, [userManager, skipSigninCallback, onSigninCallback, onSignoutCallback, matchSignoutCallback]);
  React2.useEffect(() => {
    if (!userManager) return void 0;
    const handleUserLoaded = (user) => {
      dispatch({ type: "USER_LOADED", user });
    };
    userManager.events.addUserLoaded(handleUserLoaded);
    const handleUserUnloaded = () => {
      dispatch({ type: "USER_UNLOADED" });
    };
    userManager.events.addUserUnloaded(handleUserUnloaded);
    const handleUserSignedOut = () => {
      dispatch({ type: "USER_SIGNED_OUT" });
    };
    userManager.events.addUserSignedOut(handleUserSignedOut);
    const handleSilentRenewError = (error) => {
      dispatch({ type: "ERROR", error });
    };
    userManager.events.addSilentRenewError(handleSilentRenewError);
    return () => {
      userManager.events.removeUserLoaded(handleUserLoaded);
      userManager.events.removeUserUnloaded(handleUserUnloaded);
      userManager.events.removeUserSignedOut(handleUserSignedOut);
      userManager.events.removeSilentRenewError(handleSilentRenewError);
    };
  }, [userManager]);
  const removeUser = React2.useCallback(async () => {
    if (!userManager) unsupportedEnvironment("removeUser");
    await userManager.removeUser();
    if (onRemoveUser) await onRemoveUser();
  }, [userManager, onRemoveUser]);
  const contextValue = React2.useMemo(() => {
    return {
      ...state,
      ...userManagerContext,
      removeUser
    };
  }, [state, userManagerContext, removeUser]);
  return /* @__PURE__ */ React2.createElement(AuthContext.Provider, { value: contextValue }, children);
};

// src/useAuth.ts
import React3 from "react";
var useAuth = () => {
  const context = React3.useContext(AuthContext);
  if (!context) {
    console.warn("AuthProvider context is undefined, please verify you are calling useAuth() as child of a <AuthProvider> component.");
  }
  return context;
};

// src/withAuth.tsx
import React4 from "react";
function withAuth(Component) {
  const displayName = `withAuth(${Component.displayName || Component.name})`;
  const C = (props) => {
    const auth = useAuth();
    return /* @__PURE__ */ React4.createElement(Component, { ...props, auth });
  };
  C.displayName = displayName;
  return C;
}

// src/withAuthenticationRequired.tsx
import React5 from "react";
var withAuthenticationRequired = (Component, options = {}) => {
  const { OnRedirecting = () => /* @__PURE__ */ React5.createElement(React5.Fragment, null), onBeforeSignin, signinRedirectArgs } = options;
  const displayName = `withAuthenticationRequired(${Component.displayName || Component.name})`;
  const C = (props) => {
    const auth = useAuth();
    React5.useEffect(() => {
      if (hasAuthParams() || auth.isLoading || auth.activeNavigator || auth.isAuthenticated) {
        return;
      }
      void (async () => {
        if (onBeforeSignin) await onBeforeSignin();
        await auth.signinRedirect(signinRedirectArgs);
      })();
    }, [auth.isLoading, auth.isAuthenticated, auth]);
    return auth.isAuthenticated ? /* @__PURE__ */ React5.createElement(Component, { ...props }) : OnRedirecting();
  };
  C.displayName = displayName;
  return C;
};
export {
  AuthContext,
  AuthProvider,
  hasAuthParams,
  useAuth,
  withAuth,
  withAuthenticationRequired
};
//# sourceMappingURL=react-oidc-context.js.map
