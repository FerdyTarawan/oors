import { validate, validators as v } from 'easevalidation';
import { Module } from 'oors';
import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';
import { isMiddlewarePivot } from 'oors-express/build/validators';
import withSoftDelete from 'oors-mongodb/build/decorators/withSoftDelete';
import UserService from './services/User';
import AccountService from './services/Account';
import router from './router';
import * as gqlMiddlewares from './graphql/middlewares';
import jwtMiddleware from './middlewares/jwt';
import passportInitialize from './middlewares/passportInitialize';
import passportSession from './middlewares/passportSession';
import passportFactory from './libs/passport';
import mockUser from './middlewares/mockUser';
import ForgotPasswordTemplate from './mailerTemplates/ForgotPassword';
import UserSignupTemplate from './mailerTemplates/UserSignup';
import PermissionsManager from './libs/PermissionsManager';
import { roles } from './constants/user';

class UserModule extends Module {
  static validateConfig = validate(
    v.isSchema({
      jwtSecret: [v.isRequired(), v.isString()],
      jwtConfig: [v.isRequired(), v.isObject()],
      passportMiddlewarePivot: isMiddlewarePivot(),
      mockUserMiddlewarePivot: isMiddlewarePivot(),
      mockUserConfig: [
        v.isDefault({}),
        v.isSchema({
          path: [v.isDefault('/'), v.isString()],
          enabled: [v.isDefault(false), v.isBoolean()],
          params: [v.isDefault({}), v.isObject()],
        }),
      ],
      passportConfig: [
        v.isDefault({}),
        v.isSchema({
          enabled: [v.isDefault(false), v.isBoolean()],
        }),
      ],
      emailTemplates: [v.isDefault({}), v.isObject()],
      rootURL: [v.isRequired(), v.isString()],
    }),
  );

  static defaultConfig = {
    oors: {
      mongodb: {
        repositories: {
          autoload: true,
        },
      },
      rad: {
        autoload: {
          services: false,
        },
      },
    },
  };

  name = 'oors.user';

  hooks = {
    'oors.router.load': () => {},
  };

  initialize({ jwtSecret, emailTemplates }) {
    this.jwtMiddleware = jwtMiddleware({
      secret: jwtSecret,
    });

    this.config.emailTemplates = {
      forgotPassword: ForgotPasswordTemplate,
      userSignUp: UserSignupTemplate,
      ...emailTemplates,
    };

    this.configureSeeder();
  }

  async setup({ mockUserMiddlewarePivot, mockUserConfig }) {
    await this.loadDependencies([
      'oors.mongodb',
      'oors.router',
      'oors.mailer',
      'oors.graphql',
      'oors.express',
    ]);

    const { User, Account } = this.get('repositories');
    withSoftDelete()(User);
    withSoftDelete()(Account);

    const routerConfig = {
      jwtMiddleware: this.jwtMiddleware,
    };

    this.setupServices();
    this.setupPermissions();

    this.export({
      gqlMiddlewares,
      jwtMiddleware: this.jwtMiddleware,
    });

    this.configurePassport(routerConfig);

    if (mockUserConfig.enabled) {
      this.deps['oors.express'].middlewares.insert(mockUserMiddlewarePivot, {
        ...mockUser,
        ...mockUserConfig,
      });
    }

    this.deps['oors.router'].addRouter('userRouter', router(routerConfig));
  }

  configureSeeder() {
    this.addHook('oors.mongodb', 'configureSeeder', ({ seeder }) => {
      const { User, Account } = this.get('repositories');
      seeder.addResolver('users', User.createOne.bind(User), {
        account: 'accounts',
      });
      seeder.addResolver('accounts', Account.createOne.bind(Account));
    });
  }

  configurePassport(routerConfig) {
    const { passportConfig, passportMiddlewarePivot, jwtSecret } = this.getConfig();

    if (!passportConfig.enabled) {
      return;
    }

    const passport = passportFactory({ jwtSecret });
    this.deps['oors.express'].middlewares.insert(
      passportMiddlewarePivot,
      passportInitialize,
      passportSession,
    );
    this.export({ passport });
    Object.assign(routerConfig, { passport });
  }

  setupServices() {
    const { jwtSecret, jwtConfig, emailTemplates, rootURL } = this.getConfig();
    const AccountRepository = this.get('repositories.Account');
    const UserRepository = this.get('repositories.User');
    const { Mail } = this.deps['oors.mailer'];

    const User = new UserService({
      jwtConfig: {
        key: jwtSecret,
        options: jwtConfig,
      },
      emailTemplates,
      rootURL,
      UserRepository,
      AccountRepository,
      Mail,
    });

    const Account = new AccountService({
      UserRepository,
      AccountRepository,
      Mail,
    });

    this.export({
      User,
      Account,
    });
  }

  setupPermissions() {
    this.permissions = new PermissionsManager();
    this.export({
      permissions: this.permissions,
    });

    roles.forEach(role => {
      this.permissions.define(
        `is${upperFirst(camelCase(role))}`,
        user => (user.roles || []).includes(role),
        {
          description: `User "${role}" role`,
        },
      );
    });

    this.deps['oors.graphql'].extendContext(context => {
      Object.assign(context, {
        permissionsManager: this.permissions,
      });
    });
  }
}

export default UserModule;
