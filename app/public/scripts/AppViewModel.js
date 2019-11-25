define(['ko', 'notification', 'BuildViewModel', 'OptionsViewModel'], function (ko, notification, BuildViewModel, OptionsViewModel) {
    var AppViewModel = function() {
        var self = this;

        var isLoadingInitially = true;

        this.isIntercepted = ko.observable();
        this.infoType = ko.observable();
        this.faviconImageUrl = ko.observable('images/favicon-unread.png');
        this.builds = ko.observableArray([]);
        this.isAllSuccess = ko.observable(true);
        this.version = ko.observable();
        this.options = new OptionsViewModel(self);

        this.setIsConnected = function (value) {
            if(isLoadingInitially) {
                isLoadingInitially = false;
                return;
            }

            self.isIntercepted(!value);
            self.infoType('connection');
        };

        this.setIsLoading = function (value) {
            self.isIntercepted(value);
            self.infoType('loading');
        };

        this.setHasUnreadBuilds = function (value) {
            if (value) {
              self.faviconImageUrl('images/favicon-unread.png');
            } else {
              self.faviconImageUrl('images/favicon.png');
            }
        };

        var getBuildById = function (id) {
            return self.builds().filter(function (build) {
                return build.id() === id;
            })[0];
        };

        var matchesToNotificationFilter = function (build) {
            if (!self.options.notificationFilterEnabled()) {
                return true;
            }

            var regex = new RegExp(self.options.notificationFilterValue());

            return regex.test(build.id) ||
                regex.test(build.project) ||
                regex.test(build.definition) ||
                regex.test(build.number) ||
                regex.test(build.requestedFor) ||
                regex.test(build.statusText) ||
                regex.test(build.reason);
        };

        var anyBuildMatchesToNotifcationFilter = function (builds) {

            if (builds.length === 0) {
              return false;
            }

            return builds.some( function (build) {
                return matchesToNotificationFilter(build);
            });
        };

        this.loadBuilds = function (builds) {
            self.builds.removeAll();
          if (self.options.showOnlyNonSuccess()) {
              var nonGreenBuilds = 0;
              for(var i = 0; i < self.builds.length; i++) {
                var build = self.builds[i];
                if(build.statusText !== 'Success') {
                  nonGreenBuilds += 1;
                  self.builds.push(new BuildViewModel(build));
                }
              }
              self.isAllSuccess(nonGreenBuilds  === 0);
            } else {
              self.isAllSuccess(false);
              builds.forEach(function (build) {
                self.builds.push(new BuildViewModel(build));
              });
            }
        };

        this.updateCurrentBuildsWithChanges = function (changes)  {
            if (anyBuildMatchesToNotifcationFilter(changes.removed) ||
                anyBuildMatchesToNotifcationFilter(changes.added) ||
                anyBuildMatchesToNotifcationFilter(changes.updated)) {
                self.setHasUnreadBuilds(true);
            }

            changes.removed.forEach(function (build) {
                self.builds.remove(function (item) {
                    return item.id() === build.id;
                });
                if (self.options.showOnlyNonSuccess()) {
                  var nonGreenBuilds = 0;
                  for (var i = 0; i < self.builds.length; i++) {
                    if (self.builds[i].statusText !== 'Success') {
                      nonGreenBuilds += 1;
                    }
                  }
                  self.isAllSuccess(nonGreenBuilds === 0);
                }
            });

            changes.added.forEach(function (build, index) {
                self.builds.splice(index, 0, new BuildViewModel(build));
                self.isAllSuccess(false);
            });

            changes.updated.forEach(function (build) {
                var vm = getBuildById(build.id);
                vm.update(build);

                if (self.options.showOnlyNonSuccess() && build.status === 'Green') {
                    self.builds.remove(function (item) {
                      return item.id() === build.id;
                    });
                    var nonGreenBuilds = 0;
                    for (var i = 0; i < self.builds.length; i++) {
                      if (self.builds[i].statusText !== 'Success') {
                        nonGreenBuilds += 1;
                      }
                    }
                    self.isAllSuccess(nonGreenBuilds === 0);
                }

                if (build.status === 'Red' && matchesToNotificationFilter(build)) {
                    if (self.options.soundNotificationEnabled()) {
                        var audio = new Audio('/audio/build_brakes.mp3');
                        audio.play();
                    }

                    if (self.options.browserNotificationEnabled()) {
                        notification.show(build);
                    }
                }
            });

            changes.order.forEach(function (id, index) {
                var build = getBuildById(id);
                var from = self.builds.indexOf(build);

                if (self.builds.length > 0 && from !== index) {
                    self.builds.splice(index, 0, self.builds.splice(from, 1)[0]);
                }
            });
        };

        this.updateBuildTimes = function () {
            self.builds().forEach(function (build) {
                build.time.evaluateImmediate();
                build.duration.evaluateImmediate();
            });
        };

        this.setIsLoading(true);
    };

    return AppViewModel;
});
